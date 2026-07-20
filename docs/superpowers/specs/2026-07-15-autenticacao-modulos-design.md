# Design Document — Autenticação com Token + Painel de Módulos Ativáveis

## Overview

Este documento especifica o primeiro passo da transformação do EduStock num sistema de gestão de estoque profissional e modular: **autenticação real por token** + **um painel administrativo que ativa/desativa funcionalidades (módulos) em tempo real**, sem redeploy.

Este projeto nasce de duas necessidades que convergem:
1. A auditoria técnica do sistema (2026-07-15) encontrou que toda a API REST está aberta (`AllowAny` sem exceção) e que o dashboard admin não tem nenhuma tela de login — a falha de segurança mais crítica encontrada no sistema.
2. O usuário quer transformar o EduStock num produto que combina um núcleo genérico de controle de estoque com o módulo escolar já existente, onde cada funcionalidade pode ser ligada/desligada por um administrador.

A solução para os dois problemas é a mesma peça de infraestrutura: não dá para ter um painel de módulos sem autenticação real primeiro, e a autenticação real já resolve a falha de segurança crítica.

### Escopo deste documento

**Incluído:**
- Sistema de autenticação por token (persistido em banco, não em memória)
- Papéis de usuário: `ADMIN` e `OPERADOR`
- Registro de módulos (`Modulo`) cobrindo as 6 áreas já existentes (Inventário, Movimentações, Fornecedores, Alertas, Relatórios, Merenda)
- Enforcement de módulo ativo/inativo em todos os endpoints da API existentes
- Painel admin (`AdminModulosPage`) para ativar/desativar módulos e gerenciar usuários
- Tela de login no dashboard (`frontend/`)

**Explicitamente fora de escopo (decidido com o usuário):**
- `app-alunos` e `app-cozinha` **não** migram para este sistema de login — continuam com o PIN próprio, como estão hoje. Se o módulo `merenda` for desativado, os endpoints de operação (`/api/operacao/*`) passam a responder 403, mas o mecanismo de autenticação dos dois apps não muda.
- Permissões granulares por operação dentro de um módulo (ex. "operador pode ver mas não excluir fornecedor") — os papéis controlam acesso a módulos inteiros e ao painel admin, não ações individuais. Pode ser refinado depois.
- As funcionalidades profissionais novas em si (pedido de compra, código de barras, múltiplos depósitos etc.) — este documento cobre só a infraestrutura de autenticação e módulos que vai hospedá-las. A lista de funcionalidades é um projeto seguinte, com seu próprio spec.

## Abordagens consideradas

**A — Feature-flag em banco + permissão por módulo (escolhida).** Uma tabela `Modulo` com um booleano `ativo` por slug; uma permission class de DRF checa, por request, se o módulo do endpoint está ativo. Toggle reflete imediatamente, sem redeploy.

**B — Um app Django por módulo, ativado dinamicamente via `INSTALLED_APPS`.** Rejeitada: `INSTALLED_APPS` é resolvido na inicialização do processo Django — não há como ativar/desativar em tempo real sem reiniciar os workers, o que contradiz o requisito de reflexo imediato. Também exigiria fatiar o app `core` existente em 6+ apps, uma migração grande e arriscada para um ganho arquitetural que não se realiza (já que o toggle em tempo real não funciona de qualquer forma).

**C — Toggle só no frontend, sem enforcement no backend.** Rejeitada: um módulo "desativado" continuaria com todos os seus endpoints respondendo normalmente para qualquer chamada direta à API — não é uma desativação real, e contradiz diretamente a conclusão da auditoria de que a API aberta é o problema de maior severidade do sistema.

## Arquitetura

### Novo app Django: `plataforma`

Separado do `core` (que permanece com o domínio de estoque/merenda). Contém autenticação, papéis e o registro de módulos — uma responsabilidade transversal, não de domínio.

```
plataforma/
├── models.py       # Perfil, Modulo, TokenAcesso
├── serializers.py  # LoginSerializer, ModuloSerializer, PerfilSerializer
├── permissions.py  # RequerModuloAtivo, EhAdmin
├── authentication.py  # TokenAcessoAuthentication (custom DRF authentication)
├── views.py        # LoginView, LogoutView, ModuloViewSet, UsuarioViewSet
├── urls.py
└── migrations/
    └── 0001_initial.py
    └── 0002_seed_modulos.py   # data migration, popula os 6 módulos iniciais
```

### Modelos

```python
class Perfil(models.Model):
    ADMIN = "ADMIN"
    OPERADOR = "OPERADOR"
    PAPEL_CHOICES = [(ADMIN, "Administrador"), (OPERADOR, "Operador")]

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    matricula = models.CharField(max_length=50, unique=True, blank=True)
    papel = models.CharField(max_length=10, choices=PAPEL_CHOICES, default=OPERADOR)

class Modulo(models.Model):
    slug = models.SlugField(unique=True)
    nome = models.CharField(max_length=100)
    descricao = models.CharField(max_length=255, blank=True)
    ativo = models.BooleanField(default=True)
    depende_de = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.PROTECT, related_name="dependentes"
    )

class TokenAcesso(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="tokens_acesso")
    criado_em = models.DateTimeField(auto_now_add=True)
    expira_em = models.DateTimeField()
```

`Modulo.depende_de` modela a única dependência conhecida hoje (`merenda` depende de `inventario`, porque `FatorConsumo` referencia `Produto`). A regra de negócio (em `services`/`views`, não num motor genérico): não permitir `ativo=False` num módulo que tenha dependentes com `ativo=True`.

### Autenticação por token — persistida, não em memória

`TokenAcesso` é o mesmo padrão que `core/operacao_auth.py` já usa para o login por PIN (token opaco + TTL), mas gravado em banco em vez de um dicionário em memória do processo Python — corrigindo exatamente a falha que a auditoria apontou (sessões somem a cada restart/não são compartilhadas entre workers do gunicorn).

- `POST /api/auth/login/` — recebe `username`/`password` (mesmo campo que `django.contrib.auth.User` já usa, sem necessidade de campo de e-mail novo), valida contra `django.contrib.auth`, cria um `TokenAcesso` com `expira_em = agora + LOGIN_TOKEN_TTL_HORAS` (setting, default 12h — mesmo valor já usado no módulo de PIN). Retorna:
  ```json
  { "token": "...", "papel": "ADMIN", "modulos_ativos": ["inventario", "movimentacoes", "merenda"] }
  ```
- `POST /api/auth/logout/` — apaga o `TokenAcesso` correspondente ao header enviado.
- `TokenAcessoAuthentication` — classe de autenticação DRF que lê `Authorization: Token <uuid>`, busca em `TokenAcesso`, valida `expira_em > agora`, popula `request.user`.

### Autorização por módulo

`RequerModuloAtivo(slug)` — permission class aplicada a cada ViewSet/View já existente em `core/api_views.py` e `core/operacao_views.py`:

| Endpoint | Módulo (slug) |
|---|---|
| `ProdutoViewSet`, `CategoriaViewSet`, `GrupoViewSet`, `BemPermanenteViewSet` | `inventario` |
| `MovimentacaoViewSet`, `EntradaViewSet` | `movimentacoes` |
| `FornecedorViewSet` | `fornecedores` |
| `AlertasView` | `alertas` |
| `PrestacaoContasView` | `relatorios` |
| `ContagemView`, `ResumoFrequenciaView`, `PlanoDoDiaView`, `BaixaProducaoView` (operação da merenda) | `merenda` |

Se o módulo estiver `ativo=False`, a permission retorna `False` e o DRF responde 403 com `{"detail": "Módulo 'X' está desativado."}` — **para qualquer usuário, inclusive quem tem token válido**. Isso vale também para os endpoints de operação (`app-alunos`/`app-cozinha`), que continuam autenticando por PIN normalmente, mas ficam bloqueados se `merenda` estiver desativado.

Esta mesma auditoria já havia identificado que `settings.py:152-154` define `DEFAULT_PERMISSION_CLASSES: [AllowAny]` globalmente. Este projeto muda esse default para `IsAuthenticated`, e adiciona `RequerModuloAtivo` por cima, por ViewSet.

### Papéis e permissões

- `EhAdmin` — permission class que exige `request.user.perfil.papel == Perfil.ADMIN`. Aplicada só em: `ModuloViewSet` (toggle de módulos) e `UsuarioViewSet` (gestão de usuários/papéis).
- Todo o resto exige apenas `IsAuthenticated` — qualquer papel autenticado usa os módulos ativos normalmente.

## Frontend (`frontend/`)

- **`LoginPage.jsx`** (nova) — formulário usuário/senha, chama `POST /api/auth/login/`, guarda `{ token, papel, modulos_ativos }` em `sessionStorage` (mesmo padrão já usado em `app-cozinha`/`app-alunos`, mais seguro que `localStorage`).
- **Guarda de rota em `main.jsx`** — todas as rotas do `MainLayout` passam a exigir token válido; sem token, redireciona para `/login`.
- **`Sidebar.jsx`** — a lista `navItems` (hoje estática, `Sidebar.jsx:5-19`) passa a ser filtrada pelos `modulos_ativos` recebidos no login.
- **`RequireModule` (novo componente)** — envolve cada página (`InventarioPage`, `MovimentacoesPage` etc.); se o slug do módulo não estiver na lista ativa, renderiza uma tela "módulo indisponível" em vez da página — cobre o caso de acesso direto por URL a um módulo desligado.
- **`AdminModulosPage.jsx`** (nova, só na Sidebar quando `papel === "ADMIN"`) — lista os módulos com um switch on/off cada, chamando `PATCH /api/modulos/{slug}/`. Módulos com dependentes ativos mostram o switch desabilitado com uma explicação (“Merenda depende deste módulo”).
- **Cliente HTTP (`api/http.js`)** — passa a enviar `Authorization: Token <token>` em vez de depender só de `credentials:"include"`.

## Dados / Migrações

1. `plataforma/migrations/0001_initial.py` — cria `Perfil`, `Modulo`, `TokenAcesso`.
2. `plataforma/migrations/0002_seed_modulos.py` — data migration (com função reversa) populando os 6 módulos iniciais, todos `ativo=True` (preserva 100% do comportamento atual no dia do deploy) e `merenda.depende_de = inventario`.
3. Um management command `criar_admin` (ou instrução de `createsuperuser` + criação manual do `Perfil` associado com `papel=ADMIN`) para o primeiro acesso administrativo.
4. O model `Perfil` já existe hoje em `core/models.py:6-11`, mas a auditoria confirmou zero referências a ele em qualquer lugar do código — pode ser removido de `core` e recriado em `plataforma` sem risco de quebrar nada existente.

## Tratamento de erros

| Situação | Resposta | Comportamento no frontend |
|---|---|---|
| Sem token / token inválido | 401 | Redireciona para `/login` |
| Token expirado | 401 | Redireciona para `/login`, mensagem "sessão expirada" |
| Token válido, módulo desativado | 403 com `{"detail": "Módulo 'X' está desativado."}` | Tela "módulo indisponível", não erro genérico |
| Usuário `OPERADOR` tentando acessar `/api/modulos/` ou gestão de usuários | 403 | `AdminModulosPage` nem aparece na Sidebar para esse papel |
| Tentativa de desativar módulo com dependente ativo | 400 com mensagem explicando a dependência | Switch some desabilitado com tooltip explicativo |

## Estratégia de testes

**Backend:**
- Login com credenciais corretas retorna token + papel + módulos ativos; credenciais erradas retornam 401.
- Requisição sem token em qualquer endpoint de `core/api_urls.py` retorna 401 (substituindo os testes atuais que assumem acesso anônimo — atualização necessária em `core/tests/test_api.py`).
- Requisição com token válido mas módulo desativado retorna 403.
- Toggle de módulo por usuário `OPERADOR` retorna 403; por `ADMIN` funciona e reflete imediatamente numa requisição seguinte ao endpoint do módulo.
- Tentativa de desativar `inventario` com `merenda.ativo=True` retorna 400.
- Token expirado (`expira_em` no passado) é rejeitado mesmo que exista na tabela.

**Frontend:**
- `RequireModule` redireciona para a tela "módulo indisponível" quando o slug não está na lista ativa.
- `Sidebar` só lista os itens correspondentes a `modulos_ativos`.
- `AdminModulosPage` só é acessível/visível para `papel === "ADMIN"`.
- Guarda de rota redireciona para `/login` sem token.

## Riscos

| Risco | Mitigação |
|---|---|
| Migrar todos os testes de API existentes (hoje anônimos) para autenticados é um volume de mudança considerável em `core/tests/test_api.py` | Fazer num commit dedicado, rodando a suíte completa antes de prosseguir para o resto do projeto |
| Confundir usuários operacionais (cozinha/alunos) com a mudança | Nenhuma mudança visível para eles — PIN continua igual; só o dashboard admin ganha login |
| Esquecer de popular `Modulo` com `ativo=True` na migração e "desligar" o sistema inteiro no primeiro deploy | Testar a migration em ambiente de staging antes; a migration de seed é parte obrigatória do mesmo PR |

## Extensão (2026-07-20): módulo "Financeiro"

Adicionada depois da primeira versão deste documento, quando o cliente pediu para "tirar o dinheiro" do sistema mas ressaltou que, ao vender para outros clientes, mostrar preço/custo pode ser desejável — ou seja, precisa ser uma opção ligável, não uma remoção definitiva.

Nesse meio-tempo, um plano separado (`docs/superpowers/plans/2026-07-18-turmas-pins-preco.md`, Tasks 9-13) já havia implementado exatamente essa necessidade como um toggle `mostrarPreco` em `frontend/src/lib/config.js`, persistido em `localStorage` e exposto num switch na página Configurações — funcional, mas por navegador/dispositivo, não uma decisão única do administrador para todo o sistema. Com o painel de módulos agora sendo construído, faz sentido esse controle migrar para lá.

**Decisão:** um 7º módulo, slug `financeiro`, **independente** dos outros 6 (não amarrado a `relatorios`). Motivo: `relatorios` controla acesso à página inteira de Relatórios; `financeiro` controla só a exibição de valores em R$ — em Relatórios, mas também em Inventário (cadastro/detalhes de produto) e Movimentações (formulário de entrada), lugares que não têm nada a ver com a página de Relatórios em si. As duas preocupações são ortogonais.

**Diferença do seed dos outros módulos:** os 6 módulos originais nascem `ativo=True` na migração (preservam 100% do comportamento atual no dia do deploy). `financeiro` nasce **`ativo=False`** — esse já é o estado real de produção hoje (o toggle `mostrarPreco` já está desligado por padrão) e é exatamente o que o cliente atual pediu.

**Frontend — substitui, não convive com, o mecanismo antigo:** os 6 arquivos que hoje leem `getConfig().mostrarPreco` (`ProductFormModal.jsx`, `DetailsModal.jsx`, `EntradaFormModal.jsx`, `RelatoriosView.jsx`, `prestacaoPdf.js`, `export.js`) passam a ler `getModulosAtivos().includes("financeiro")` de `frontend/src/lib/auth.js` (já criado na Task 12 deste plano). O campo `mostrarPreco` e sua validação saem de `config.js`/`config.test.js`, e o switch "Mostrar preços e custos" sai de `ConfiguracoesPage.jsx` — a partir de agora, essa decisão é do ADMIN em `/admin/modulos`, não de cada usuário na própria máquina. O efeito é imediato para todo mundo a partir do próximo login (os módulos ativos vêm no payload de `/api/auth/login/`).

**Fora de escopo (deliberado):** enforcement no backend a nível de campo (ex. remover `preco`/`preco_unitario` da resposta JSON de `/api/produtos/` quando `financeiro` está desativado). O pedido do cliente é sobre o que aparece na tela, não sobre um requisito de compliance que exija blindar a API contra alguém abrindo o DevTools — mesmo padrão de escopo que o `mostrarPreco` original já tinha. Pode ser revisitado se um cliente futuro pedir isso explicitamente.

## Próximos passos (fora deste documento)

Depois deste projeto entregue e implantado: (1) lista de funcionalidades profissionais candidatas a novos módulos (pedido de compra, código de barras, múltiplos depósitos, etc.), cada uma com seu próprio spec; (2) aprofundamento do módulo escolar (cardápio nutricional, múltiplas unidades escolares); (3) considerar aplicar o mesmo padrão de `TokenAcesso` persistido para substituir o dicionário em memória do `operacao_auth.py`, hoje usado só pelo PIN.
