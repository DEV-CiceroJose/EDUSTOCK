import csv
import io
import uuid

from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from openpyxl import Workbook
from rest_framework import serializers
from rest_framework.permissions import BasePermission, IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Produto, Turma
from core.operacao_auth import requer_perfil_operacao
from plataforma.models import Escola, VinculoUsuario, RegistroAuditoria
from plataforma.permissions import escola_do_request, vinculos_ativos_do_usuario, RequerModuloAtivo
from .models import Aluno, Rodada, ItemRodada, Destinatario
from .importacao import ler_arquivo, preparar_linhas
from .services import mudar_estado, entregar


class GestorDaEscola(BasePermission):
    message = 'Somente a gestão da escola ou da rede pode gerenciar alunos e entregas.'

    def has_permission(self, request, view):
        escola = escola_do_request(request)
        if not escola:
            return False
        return vinculos_ativos_do_usuario(request.user).filter(
            Q(papel=VinculoUsuario.GESTOR_ESCOLA, escola=escola) |
            Q(papel=VinculoUsuario.GESTOR_REDE, municipio=escola.municipio)
        ).exists()


class Privado(APIView):
    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Cache-Control'] = 'no-store'
        return response

    def handle_exception(self, exc):
        if isinstance(exc, DjangoValidationError):
            exc = serializers.ValidationError({'detail': ' '.join(exc.messages)})
        return super().handle_exception(exc)


class Gestao(Privado):
    permission_classes = [IsAuthenticated, RequerModuloAtivo('inventario'), GestorDaEscola]


class AlunoSerializer(serializers.ModelSerializer):
    turma_nome = serializers.CharField(source='turma.nome', read_only=True)

    class Meta:
        model = Aluno
        fields = ['id', 'nome', 'turma', 'turma_nome', 'serie', 'sexo', 'ativo']
        read_only_fields = ['id']

    def validate_turma(self, turma):
        if turma.escola_id != self.context['escola'].pk or not turma.ativo:
            raise serializers.ValidationError('Selecione uma turma ativa da escola atual.')
        return turma


class AlunosView(Gestao):
    def get(self, request):
        escola = escola_do_request(request)
        alunos = Aluno.objects.filter(escola=escola).select_related('turma')
        total = alunos.filter(ativo=True).count()
        por_turma = list(alunos.filter(ativo=True).values('turma_id', 'turma__nome').annotate(total=Count('id')))
        if request.query_params.get('turma'):
            alunos = alunos.filter(turma_id=inteiro(request.query_params['turma']))
        if request.query_params.get('search'):
            alunos = alunos.filter(nome__icontains=request.query_params['search'][:200])
        return Response({'alunos': AlunoSerializer(alunos, many=True).data, 'total_ativos': total,
                         'por_turma': por_turma,
                         'turmas': list(Turma.objects.filter(escola=escola, ativo=True).values('id', 'nome')),
                         'produtos': list(Produto.objects.filter(escola=escola).order_by('nome').values('id', 'nome', 'unidade', 'quantidade'))})

    @transaction.atomic
    def post(self, request):
        escola = escola_do_request(request)
        Escola.objects.select_for_update().get(pk=escola.pk)
        serializer = AlunoSerializer(data=request.data, context={'escola': escola})
        serializer.is_valid(raise_exception=True)
        aluno = serializer.save(escola=escola)
        auditar(request, escola, 'CADASTROU', 'aluno', aluno.pk)
        return Response(serializer.data, status=201)


class AlunoDetailView(Gestao):
    @transaction.atomic
    def patch(self, request, pk):
        escola = escola_do_request(request)
        Escola.objects.select_for_update().get(pk=escola.pk)
        aluno = get_object_or_404(Aluno, pk=pk, escola=escola)
        serializer = AlunoSerializer(aluno, data=request.data, partial=True, context={'escola': escola})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        auditar(request, escola, 'ALTEROU', 'aluno', aluno.pk)
        return Response(serializer.data)


def auditar(request, escola, acao, recurso, pk):
    RegistroAuditoria.objects.create(user=request.user, escola=escola, acao=acao, recurso=recurso, objeto_id=str(pk))


class ModeloView(Gestao):
    def get(self, request):
        livro = Workbook()
        livro.active.title = 'Alunos'
        livro.active.append(['nome', 'turma', 'série', 'sexo'])
        for coluna in ['A', 'B', 'C', 'D']:
            livro.active.column_dimensions[coluna].width = 28
        arquivo = io.BytesIO()
        livro.save(arquivo)
        response = HttpResponse(arquivo.getvalue(), content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = 'attachment; filename="modelo-alunos.xlsx"'
        return response


class ImportacaoView(Gestao):
    def post(self, request):
        escola = escola_do_request(request)
        linhas = ler_arquivo(request.FILES.get('arquivo'))
        novos, erros, avisos = preparar_linhas(linhas, escola)
        token = str(uuid.uuid4())
        if not erros:
            cache.set(f'importacao-alunos:{token}', {'escola': escola.pk, 'user': request.user.pk, 'linhas': linhas}, 900)
        return Response({'token': token if not erros else None, 'novos': len(novos), 'ignorados': len(avisos),
                         'erros': erros, 'avisos': avisos, 'previa': novos[:100]})

    @transaction.atomic
    def put(self, request):
        escola = escola_do_request(request)
        Escola.objects.select_for_update().get(pk=escola.pk)
        chave = f"importacao-alunos:{str(request.data.get('token', ''))[:40]}"
        previa = cache.get(chave)
        if not previa or previa['escola'] != escola.pk or previa['user'] != request.user.pk:
            raise serializers.ValidationError({'detail': 'Prévia expirada ou de outra sessão. Envie a planilha novamente.'})
        novos, erros, avisos = preparar_linhas(previa['linhas'], escola)
        if erros:
            raise serializers.ValidationError({'detail': 'O cadastro mudou. Revise a planilha novamente.', 'erros': erros})
        Aluno.objects.bulk_create([Aluno(escola=escola, **linha) for linha in novos])
        auditar(request, escola, 'IMPORTOU', 'alunos', len(novos))
        transaction.on_commit(lambda: cache.delete(chave))
        return Response({'criados': len(novos), 'ignorados': len(avisos)})


class ItemSerializer(serializers.ModelSerializer):
    produto_nome = serializers.CharField(source='produto.nome', read_only=True)
    unidade = serializers.CharField(source='produto.unidade', read_only=True)

    class Meta:
        model = ItemRodada
        fields = ['produto', 'produto_nome', 'quantidade', 'unidade']


class RodadaSerializer(serializers.ModelSerializer):
    itens = ItemSerializer(many=True)
    total = serializers.IntegerField(read_only=True)
    entregues = serializers.IntegerField(read_only=True)

    class Meta:
        model = Rodada
        fields = ['id', 'titulo', 'tipo', 'estado', 'liberado_em', 'itens', 'total', 'entregues']
        read_only_fields = ['id', 'estado', 'liberado_em']

    def validate_itens(self, itens):
        if not itens or len(itens) > 30:
            raise serializers.ValidationError('Informe de 1 a 30 itens.')
        ids = set()
        for item in itens:
            produto = item['produto']
            if produto.escola_id != self.context['escola'].pk or produto.pk in ids:
                raise serializers.ValidationError('Os produtos devem ser da escola atual, sem repetição.')
            ids.add(produto.pk)
        return itens

    @transaction.atomic
    def create(self, validated_data):
        itens = validated_data.pop('itens')
        rodada = Rodada.objects.create(**validated_data)
        ItemRodada.objects.bulk_create([ItemRodada(rodada=rodada, **item) for item in itens])
        return rodada


def rodadas(escola_id):
    return Rodada.objects.filter(escola_id=escola_id).prefetch_related('itens__produto').annotate(
        total=Count('destinatarios'), entregues=Count('destinatarios', filter=Q(destinatarios__entregue_em__isnull=False)))


class RodadasView(Gestao):
    def get(self, request):
        return Response(RodadaSerializer(rodadas(escola_do_request(request).pk), many=True).data)

    def post(self, request):
        escola = escola_do_request(request)
        serializer = RodadaSerializer(data=request.data, context={'escola': escola})
        serializer.is_valid(raise_exception=True)
        serializer.save(escola=escola, criado_por=request.user)
        return Response(serializer.data, status=201)


class EstadoView(Gestao):
    def post(self, request, pk):
        escola = escola_do_request(request)
        get_object_or_404(Rodada, pk=pk, escola=escola)
        if request.data.get('estado') not in [e[0] for e in Rodada.ESTADOS]:
            raise serializers.ValidationError({'detail': 'Situação inválida.'})
        mudar_estado(pk, escola, request.data.get('estado'), request.user)
        return Response(RodadaSerializer(rodadas(escola.pk).get(pk=pk)).data)


def inteiro(valor):
    try:
        numero = int(valor)
        if numero <= 0:
            raise ValueError
        return numero
    except (TypeError, ValueError):
        raise serializers.ValidationError({'detail': 'Filtro numérico inválido.'}) from None


class DestinoSerializer(serializers.ModelSerializer):
    rodada_titulo = serializers.CharField(source='rodada.titulo')
    tipo = serializers.CharField(source='rodada.tipo')
    estado = serializers.CharField(source='rodada.estado')
    materiais = serializers.SerializerMethodField()

    def get_materiais(self, obj):
        return '; '.join(f'{item.produto.nome}: {item.quantidade} {item.produto.unidade}' for item in obj.rodada.itens.all())

    class Meta:
        model = Destinatario
        fields = ['id', 'aluno_id', 'rodada_id', 'rodada_titulo', 'tipo', 'estado', 'nome', 'turma_nome', 'serie', 'entregue_em', 'responsavel', 'materiais']


class RelatorioView(Gestao):
    def get(self, request):
        escola = escola_do_request(request)
        qs = Destinatario.objects.filter(rodada__escola=escola).select_related('rodada').prefetch_related('rodada__itens__produto')
        for parametro, campo in [('rodada', 'rodada_id'), ('turma', 'turma_id')]:
            if request.query_params.get(parametro):
                qs = qs.filter(**{campo: inteiro(request.query_params[parametro])})
        if request.query_params.get('tipo'):
            qs = qs.filter(rodada__tipo=request.query_params['tipo'])
        total = qs.count()
        entregues = qs.filter(entregue_em__isnull=False).count()
        situacao = request.query_params.get('situacao')
        if situacao in ['ENTREGUE', 'PENDENTE']:
            qs = qs.filter(entregue_em__isnull=situacao == 'PENDENTE')
        dados = DestinoSerializer(qs, many=True).data
        if request.query_params.get('exportar') == 'csv':
            response = HttpResponse(content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = 'attachment; filename="relatorio-entregas.csv"'
            response.write('\ufeff')
            writer = csv.writer(response, delimiter=';')
            writer.writerow(['Escola', 'Rodada', 'Tipo', 'Aluno ID', 'Nome', 'Turma', 'Série', 'Situação', 'Data entrega', 'Responsável', 'Materiais por aluno'])
            for linha in dados:
                valores = [escola.nome, linha['rodada_titulo'], linha['tipo'], linha['aluno_id'], linha['nome'],
                           linha['turma_nome'], linha['serie'], 'Entregue' if linha['entregue_em'] else 'Pendente',
                           linha['entregue_em'] or '', linha['responsavel'], linha['materiais']]
                writer.writerow([seguro_csv(v) for v in valores])
            return response
        return Response({'escola': escola.nome, 'total': total, 'entregues': entregues, 'pendentes': total - entregues,
                         'percentual': round(100 * entregues / total, 1) if total else 0, 'resultados': dados})


def seguro_csv(valor):
    texto = str(valor)
    return "'" + texto if texto.startswith(('\t', '\r', '\n')) or texto.lstrip().startswith(('=', '+', '-', '@')) else texto


class OperacaoEntregasView(Privado):
    permission_classes = [AllowAny, RequerModuloAtivo('inventario'), RequerModuloAtivo('merenda')]

    @requer_perfil_operacao('ALUNO_REP')
    def get(self, request):
        sessao = request.sessao_operacao
        qs = Destinatario.objects.filter(rodada__escola_id=sessao['escola_id'], turma_id=sessao.get('turma_id'),
                                        rodada__estado='LIBERADA').select_related('rodada').prefetch_related('rodada__itens__produto')
        visiveis = Rodada.objects.filter(escola_id=sessao['escola_id'], estado='LIBERADA',
                                        destinatarios__turma_id=sessao.get('turma_id')).distinct().prefetch_related('itens__produto')
        return Response({'rodadas': RodadaSerializer(visiveis, many=True).data,
                         'alunos': DestinoSerializer(qs, many=True).data})

    @requer_perfil_operacao('ALUNO_REP')
    def post(self, request):
        alvo = entregar(inteiro(request.data.get('destinatario')), request.sessao_operacao)
        return Response(DestinoSerializer(alvo).data)
