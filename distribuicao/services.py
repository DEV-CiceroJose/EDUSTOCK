from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from core.models import PinAcesso
from core.services import registrar_movimentacao
from plataforma.models import Escola, RegistroAuditoria
from .models import Aluno, Rodada, Destinatario


@transaction.atomic
def mudar_estado(rodada_id, escola, estado, user):
    # A importação também bloqueia a escola: a lista não muda durante a liberação.
    Escola.objects.select_for_update().get(pk=escola.pk)
    rodada = Rodada.objects.select_for_update().get(pk=rodada_id, escola=escola)
    transicoes = {'RASCUNHO': {'LIBERADA', 'ENCERRADA'}, 'LIBERADA': {'SUSPENSA', 'ENCERRADA'},
                 'SUSPENSA': {'LIBERADA', 'ENCERRADA'}, 'ENCERRADA': set()}
    if estado not in transicoes[rodada.estado]:
        raise ValidationError('Esta mudança de situação não é permitida.')
    if estado == 'LIBERADA' and rodada.liberado_em is None:
        if not rodada.itens.exists():
            raise ValidationError('Adicione ao menos um item à rodada.')
        alunos = Aluno.objects.filter(escola=escola, ativo=True, turma__ativo=True).select_related('turma')
        if rodada.tipo == 'ABSORVENTE':
            alunos = alunos.filter(sexo='F')
        destinos = [Destinatario(rodada=rodada, aluno=a, turma=a.turma, nome=a.nome,
                                turma_nome=a.turma.nome, serie=a.serie) for a in alunos]
        if not destinos:
            raise ValidationError('Não há alunos elegíveis. Confira o cadastro antes de liberar.')
        Destinatario.objects.bulk_create(destinos)
        rodada.liberado_em = timezone.now()
    rodada.estado = estado
    rodada.save(update_fields=['estado', 'liberado_em'])
    RegistroAuditoria.objects.create(user=user, escola=escola, acao=estado, recurso='rodada', objeto_id=str(rodada.pk))
    return rodada


@transaction.atomic
def entregar(destinatario_id, sessao):
    alvo = Destinatario.objects.filter(pk=destinatario_id, rodada__escola_id=sessao['escola_id'],
                                      turma_id=sessao.get('turma_id')).first()
    if alvo is None:
        raise ValidationError('Aluno não disponível para esta turma e escola.')
    rodada = Rodada.objects.select_for_update().get(pk=alvo.rodada_id)
    alvo = Destinatario.objects.select_for_update().get(pk=alvo.pk)
    if alvo.entregue_em:
        return alvo
    if rodada.estado != 'LIBERADA':
        raise ValidationError('A gestão precisa liberar esta rodada antes da entrega.')
    pin = PinAcesso.objects.filter(pk=sessao.get('pin_acesso_id'), escola=rodada.escola,
                                  turma_id=alvo.turma_id, ativo=True, papel=PinAcesso.ALUNO_REP).first()
    if pin is None:
        raise ValidationError('PIN de protagonista inválido. Entre novamente.')
    for item in rodada.itens.select_related('produto').order_by('produto_id'):
        movimento = registrar_movimentacao(produto=item.produto, tipo='SAIDA', quantidade=item.quantidade,
                                           escola=rodada.escola, motivo=f'Entrega rodada {rodada.pk}, destinatário {alvo.pk}')
        alvo.movimentos.add(movimento)
    alvo.entregue_em = timezone.now()
    alvo.pin = pin
    alvo.responsavel = f'PIN #{pin.pk} · {alvo.turma_nome}'
    alvo.save(update_fields=['entregue_em', 'pin', 'responsavel'])
    RegistroAuditoria.objects.create(escola=rodada.escola, acao='ENTREGOU', recurso='distribuicao',
                                    objeto_id=str(alvo.pk), detalhes={'pin_id': pin.pk, 'rodada_id': rodada.pk})
    return alvo
