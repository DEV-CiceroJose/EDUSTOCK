# Design Document — Turmas reais, PINs administráveis e alternância de exibição de preço

## Overview

Três correções pedidas pelo cliente depois de rodar o sistema pela primeira vez com o backend real (em vez dos dados mock):

1. Nomes de categoria com encoding corrompido (`GÃªneros AlimentÃ­cios`) — **já corrigido diretamente no banco**, resíduo de uma tentativa de seed via shell do Windows nesta mesma sessão, não um bug do sistema. Não há tarefa de código associada; mencionado aqui só para registro.
2. As turmas de demonstração (6A, 7B, 8C, 9A...) não existem na escola real. As turmas reais são 12: 1º/2º/3º ano de Desenvolvimento de Sistemas (DS) e de Eletrotécnica (TET), cada ano com turmas A e B, todas em turno Integral.
3. O cliente não quer que o sistema colete nem exiba, em nenhum relatório, quanto custa cada item — mas quer poder religar essa coleta/exibição depois, então precisa ser um alternador (toggle), não uma remoção definitiva.

Durante o desenho da tarefa 2 surgiu um problema de segurança no mecanismo de PIN atual: os PINs de todas as turmas ficam fixos em `settings.py` **e duplicados dentro do bundle JavaScript do app-alunos** (`VITE_PINS`), visíveis a qualquer pessoa que abra o código-fonte da página no navegador. Como agora os PINs serão escolhidos pelos próprios alunos/equipe da cozinha (3 alunos representantes por turma, mais a equipe da cozinha) e digitados pelo administrador, isso deixa de ser viável — os PINs precisam morar no banco de dados, geridos por uma tela administrativa, e o app-alunos precisa parar de guardar uma cópia local deles.

## Escopo deste documento

**Incluído:**
- Modelos `Turma` e `PinAcesso` no app `core`, geridos via Django Admin.
- Migração de dados populando as 12 turmas reais.
- Reescrita de `core/operacao_auth.py` para validar PIN contra o banco em vez de `settings.py`.
- Remoção do mapeamento de PIN local no `app-alunos` (`PinLogin.jsx`) — toda tentativa de PIN de 4 dígitos vai ao backend.
- Atualização dos atalhos de turma em `frontend/src/features/merenda/ContagemView.jsx` para os nomes reais.
- Alternador `mostrarPreco` em `frontend/src/lib/config.js` + `ConfiguracoesPage.jsx`, ocultando preço/custo em cadastro de produto, formulário de entrada, detalhes do item, relatórios e exportação em PDF quando desligado (padrão: desligado).

**Explicitamente fora de escopo:**
- Autenticação por usuário/senha para o dashboard admin (`frontend/`) — existe um spec separado (`2026-07-15-autenticacao-modulos-design.md`) para isso, ainda não implementado. Este documento não depende dele nem o antecipa.
- Hash/criptografia do PIN no banco — o modelo de ameaça não muda em relação ao que já existe hoje (PIN de 4 dígitos fixado em texto plano em `settings.py`); trocar para hash exigiria também mudar a UX do Django Admin (não dá pra "ver o que já foi cadastrado" num hash) sem reduzir risco real, já que quem acessa o Admin já tem acesso total ao sistema.
- Expor `Turma`/`PinAcesso` via API REST — a gestão é só pelo Django Admin (exigência do cliente), então não há necessidade de endpoints públicos novos.
- Qualquer mudança em como `FrequenciaDiaria` impede contagem duplicada — a trava já existe (`UniqueConstraint` em `data+turno+turma`, ver `core/models.py:245-248`, aplicada em `core/operacao_views.py:134-152`) e continua funcionando sem alteração, desde que os 3 PINs de uma turma resolvam para o mesmo `turma.nome` — o que a FK de `PinAcesso` para `Turma` garante por construção.

## Abordagens consideradas

**A — `Turma`/`PinAcesso` no banco, geridos pelo Django Admin (escolhida).** Reaproveita a tela administrativa que já vem pronta no Django, protegida por login (`is_staff`), sem precisar construir uma tela nova no `frontend`. Mais rápido de entregar e mais seguro por padrão (a API REST do sistema é hoje `AllowAny` para tudo — não seria seguro expor PINs por lá).

**B — Nova página dentro do `frontend`.** Rejeitada por decisão do cliente nesta sessão: mais trabalho de construção (nova tela, formulários, endpoints DRF, testes) para um ganho de UX que não compensa o esforço neste momento, considerando que quem usa essa tela é só o administrador.

**C — Continuar com PIN fixo em `settings.py`/`.env`, só trocando os valores de demonstração pelos reais.** Rejeitada: não atende ao requisito de "os alunos escolhem a própria senha e eu digito lá" — exigiria redeploy a cada PIN trocado, e mantém o vazamento de PINs no bundle JS do app-alunos.

## Arquitetura

### Novos modelos em `core/models.py`

```python
class Turma(models.Model):
    DS, TET = "DS", "TET"
    CURSO_CHOICES = [(DS, "Desenvolvimento de Sistemas"), (TET, "Eletrotécnica")]

    MANHA, TARDE, INTEGRAL = "MANHA", "TARDE", "INTEGRAL"
    TURNO_CHOICES = [(MANHA, "Manhã"), (TARDE, "Tarde"), (INTEGRAL, "Integral")]

    nome = models.CharField(max_length=50, unique=True)   # ex.: "1º DS-A"
    curso = models.CharField(max_length=3, choices=CURSO_CHOICES)
    ano = models.PositiveSmallIntegerField()               # 1, 2 ou 3
    turno = models.CharField(max_length=10, choices=TURNO_CHOICES, default=INTEGRAL)
    ativo = models.BooleanField(default=True)

    class Meta:
        ordering = ["curso", "ano", "nome"]
        verbose_name = "Turma"
        verbose_name_plural = "Turmas"

    def __str__(self):
        return self.nome


class PinAcesso(models.Model):
    ALUNO_REP, COZINHA = "ALUNO_REP", "COZINHA"
    PAPEL_CHOICES = [(ALUNO_REP, "Representante de turma"), (COZINHA, "Equipe da cozinha")]

    papel = models.CharField(max_length=10, choices=PAPEL_CHOICES, default=ALUNO_REP)
    turma = models.ForeignKey(Turma, on_delete=models.CASCADE, null=True, blank=True, related_name="pins")
    pin = models.CharField(
        max_length=4, unique=True,
        validators=[RegexValidator(r"^\d{4}$", "PIN deve ter exatamente 4 dígitos.")],
    )
    titular = models.CharField("Nome de quem escolheu o PIN", max_length=100, blank=True)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["turma__nome", "papel"]
        verbose_name = "PIN de acesso"
        verbose_name_plural = "PINs de acesso"
        constraints = [
            models.CheckConstraint(
                check=(
                    Q(papel="ALUNO_REP", turma__isnull=False)
                    | Q(papel="COZINHA", turma__isnull=True)
                ),
                name="turma_obrigatoria_apenas_para_aluno_rep",
            )
        ]

    def __str__(self):
        alvo = self.turma.nome if self.turma else "Cozinha"
        return f"{alvo} — {self.pin}"
```

`pin` é único **globalmente** (não só por papel/turma) — evita ambiguidade de digitação para o administrador: um PIN nunca pertence a mais de uma pessoa/turma no sistema todo. O `CheckConstraint` impede o erro de cadastrar um representante de turma sem turma vinculada, ou um PIN de cozinha com turma vinculada — refletindo a regra de negócio no banco, não só na tela.

### Django Admin (`core/admin.py`)

```python
class PinAcessoInline(admin.TabularInline):
    model = PinAcesso
    extra = 3
    fields = ["pin", "titular", "ativo"]
    # papel usa o default ALUNO_REP do model; não aparece aqui.

@admin.register(Turma)
class TurmaAdmin(admin.ModelAdmin):
    list_display = ["nome", "curso", "ano", "turno", "ativo"]
    list_filter = ["curso", "turno", "ativo"]
    inlines = [PinAcessoInline]

@admin.register(PinAcesso)
class PinAcessoAdmin(admin.ModelAdmin):
    list_display = ["pin", "papel", "turma", "titular", "ativo"]
    list_filter = ["papel", "ativo"]
    search_fields = ["pin", "titular", "turma__nome"]
```

Abrir uma turma no Admin já mostra 3 linhas prontas para preencher PIN + nome de quem escolheu — cobre o "3 por turma" diretamente. Os PINs da equipe da cozinha (sem turma) são cadastrados pela tela `PinAcesso` avulsa, com `papel = Equipe da cozinha`.

### Autenticação (`core/operacao_auth.py`)

`_pins_alunos()` e `_pin_cozinha()` deixam de ler `settings.OPERACAO_PINS_ALUNOS`/`OPERACAO_PIN_COZINHA` e passam a consultar `PinAcesso`:

```python
def _pins_alunos() -> dict[str, dict]:
    from core.models import PinAcesso
    return {
        p.pin: {"turma": p.turma.nome, "turno": p.turma.turno}
        for p in PinAcesso.objects.filter(papel=PinAcesso.ALUNO_REP, ativo=True).select_related("turma")
    }

def _pin_valido_cozinha(pin: str) -> bool:
    from core.models import PinAcesso
    return PinAcesso.objects.filter(papel=PinAcesso.COZINHA, ativo=True, pin=pin).exists()
```

`autenticar_pin()` muda a chamada de `_pin_cozinha() == pin` para `_pin_valido_cozinha(pin)`. O restante do fluxo (criação de token, TTL, decorador `requer_perfil_operacao`) não muda.

`settings.py` perde os blocos `OPERACAO_PINS_ALUNOS` e `OPERACAO_PIN_COZINHA` (linhas 184-197) — substituídos pelo banco.

### `app-alunos` — remoção do mapeamento local de PIN

`PinLogin.jsx` hoje **recusa localmente** qualquer PIN que não esteja em `VITE_PINS`, sem nunca chamar o backend (`MAPA_PINS[pinVal]` ausente → mostra erro e para). Isso muda para: todo PIN de 4 dígitos é enviado ao backend, que é a única fonte de verdade. Mesmo padrão que `app-cozinha/PinLogin.jsx` já usa hoje (comentário no próprio arquivo: *"Verificação local antes de ir ao servidor... validação final sempre no backend"*, e funciona mesmo sem PIN local configurado).

- Remove `carregarMapaPins()`, `MAPA_PINS`, `VITE_PINS`, `VITE_TURNOS`.
- Remove o rodapé de pré-visualização "Turma X — turno" (dependia de conhecer o mapeamento local antes do envio; deixa de ser possível). A turma confirmada aparece na tela seguinte (`/registrar`), que já exibe essa informação.
- `api.js`: `login(pin, turma, turno)` vira `login(pin)` — turma e turno sempre vêm da resposta do servidor, nunca de fallback local.
- `app-alunos/.env.example`: remove `VITE_PINS`/`VITE_TURNOS`, adiciona comentário explicando que PINs agora são geridos pelo Django Admin.

`app-cozinha` não muda de código — só o `.env.example` perde o exemplo de `VITE_PIN_COZINHA` fixo (comentário substituído por nota de que múltiplos PINs da equipe são geridos pelo Admin).

### Atalhos de turma no painel admin (`frontend/src/features/merenda/ContagemView.jsx`)

`TURMAS_RAPIDAS` troca de `["Total", "6A", "7B", "8C"]` para `["Total", "1º DS-A", "1º DS-B", "2º DS-A", "2º DS-B", "3º DS-A", "3º DS-B", "1º TET-A", "1º TET-B", "2º TET-A", "2º TET-B", "3º TET-A", "3º TET-B"]` — usando o texto exatamente igual ao `Turma.nome` cadastrado, para que a trava de contagem duplicada (`unique_frequencia_por_turma_turno_dia`) also valha se a cozinha registrar manualmente por aqui em vez de um aluno registrar pelo app-alunos.

### Idempotência da contagem (confirmação, sem mudança de código)

A proteção contra contagem duplicada já existe: `FrequenciaDiaria` tem `UniqueConstraint(fields=["data", "turno", "turma"])` (`core/models.py:245-248`), e `ContagemView.post` (`core/operacao_views.py:134-152`) captura `IntegrityError` e devolve HTTP 409 com mensagem amigável. Como os 3 `PinAcesso` de uma turma apontam para a mesma linha `Turma`, os 3 alunos representantes sempre autenticam com o mesmo `turma.nome` — o primeiro que registrar "vence"; os outros dois recebem "Frequência já registrada hoje para esta turma" ao tentar. Nenhuma mudança é necessária aqui; documentado para deixar explícito que a garantia pedida pelo cliente já é coberta pelo desenho.

### Alternador de exibição de preço

Segue o padrão já usado por `useMock` em `frontend/src/lib/config.js` / `ConfiguracoesPage.jsx`:

- `DEFAULT_CONFIG.mostrarPreco = false` (novo campo, validado em `isValidConfig` como boolean).
- Novo switch em `ConfiguracoesPage.jsx`, seção "Exibição de Custos", chamando `updateConfig({ mostrarPreco: !config.mostrarPreco })` seguido de `window.location.reload()` — mesmo comportamento do toggle de mock, para que todo componente já aberto releia o config de forma consistente sem precisar de um contexto React novo.
- Arquivos que passam a checar `getConfig().mostrarPreco` antes de mostrar campo/coluna/total de preço: `ProductFormModal.jsx`, `EntradaFormModal.jsx`, `DetailsModal.jsx` (inventário), `RelatoriosView.jsx`, `useDashboardData.js` (widgets financeiros do dashboard), `prestacaoPdf.js` e `export.js` (exportação/PDF de prestação de contas).
- Nenhuma mudança no backend: os campos `preco_unitario`/`preco` já são opcionais e todo o código em `core/relatorios.py` já trata preço ausente como zero/omitido (`if preco: ... else Decimal("0")`, `preco_unitario__isnull=False` em filtros). Desligar o alternador só para de **pedir e mostrar** preço na interface; nada é apagado do banco, e religar o alternador volta a mostrar os dados já existentes.

## Dados / Migrações

1. `core/migrations/0012_turma_pin_acesso.py` — cria `Turma` e `PinAcesso` (próximo número livre; a última migração hoje é `0011_frequencia_registrado_por_turma`).
2. `core/migrations/0013_seed_turmas.py` — data migration (com função reversa) populando as 12 turmas reais, todas `turno=INTEGRAL`.
3. Remoção de `OPERACAO_PINS_ALUNOS`/`OPERACAO_PIN_COZINHA` de `settings.py` — não é uma migration de banco, é uma edição de código feita no mesmo commit que a troca de `operacao_auth.py`.
4. Nenhuma migração de dado é necessária para o alternador de preço — é 100% frontend (`localStorage`).

## Tratamento de erros

| Situação | Resposta | Comportamento no frontend |
|---|---|---|
| PIN de 4 dígitos não cadastrado (nem turma nem cozinha) | 401 (mesmo comportamento atual de `autenticar_pin` retornando `None`) | "PIN inválido. Tente novamente." |
| PIN cadastrado mas `ativo=False` | 401 (mesmo caminho — query já filtra `ativo=True`) | "PIN inválido. Tente novamente." — indistinguível de PIN inexistente, de propósito (não revela ao usuário se o PIN já existiu) |
| Segundo representante da mesma turma tenta registrar contagem já feita no turno/dia | 409 (sem mudança — já existente) | Toast "Já existe contagem..." (já existente) |
| Dois PINs cadastrados iguais (tentativa via Admin) | `IntegrityError` de `unique=True` em `pin`, Django Admin mostra erro de validação no formulário | Admin corrige antes de salvar |
| Cadastro de `PinAcesso` com `papel=ALUNO_REP` sem turma, ou `papel=COZINHA` com turma | `CheckConstraint` rejeita no banco; Django Admin mostra erro de validação | Admin corrige antes de salvar |

## Estratégia de testes

**Backend:**
- `PinAcesso` com `papel=ALUNO_REP` e `turma=None` falha ao salvar (constraint).
- `PinAcesso` com `papel=COZINHA` e `turma` preenchida falha ao salvar (constraint).
- Dois `PinAcesso` com o mesmo `pin` falham (unique).
- `autenticar_pin(PERFIL_ALUNO, pin)` retorna turma/turno corretos para um PIN de `PinAcesso` ativo; retorna `None` para PIN inativo ou inexistente.
- `autenticar_pin(PERFIL_COZINHA, pin)` idem, para PINs de cozinha.
- Dois `PinAcesso` diferentes da mesma `Turma` autenticam com sucesso, ambos retornando o mesmo `turma.nome`; o segundo `POST /api/operacao/contagem/` no mesmo turno/dia retorna 409 (teste de regressão garantindo que a mudança de fonte de PIN não quebrou a trava existente).
- Atualizar `core/tests/test_operacao.py`/`test_operacao_spec.py` que hoje criam PINs via `settings.OPERACAO_PINS_ALUNOS` para criar `Turma`/`PinAcesso` via ORM no `setUp`.

**Frontend:**
- `app-alunos`: digitar um PIN de 4 dígitos sempre chama `login()` (sem early-return local); erro 401 do backend mostra "PIN inválido".
- `ConfiguracoesPage`: alternar `mostrarPreco` persiste em `localStorage` e recarrega a página.
- Com `mostrarPreco=false`, `ProductFormModal`/`EntradaFormModal` não enviam nem exibem campo de preço; `RelatoriosView`/PDF não mostram coluna nem total em R$.

## Riscos

| Risco | Mitigação |
|---|---|
| Esquecer de popular as 12 turmas na migração e deixar o Admin vazio no primeiro deploy | A migration de seed é parte obrigatória do mesmo commit/PR que cria os modelos; testar `python manage.py migrate` do zero antes de considerar concluído. |
| Remover `VITE_PINS`/`VITE_TURNOS` sem atualizar `README.md`/`DEPLOY.md`, que hoje documentam esse fluxo | Atualizar a documentação junto com o código, no mesmo commit. |
| Perder a trava de contagem duplicada por engano se `ContagemView.jsx` (painel admin) usar um texto de turma diferente do cadastrado (ex.: abreviação) | Usar exatamente `Turma.nome` nos atalhos, documentado explicitamente nesta spec. |
| Confundir "PIN inválido" com "PIN desativado" pode dificultar suporte ao aluno | Aceito deliberadamente — não vale a pena vazar essa distinção para quem está tentando adivinhar PINs. |
