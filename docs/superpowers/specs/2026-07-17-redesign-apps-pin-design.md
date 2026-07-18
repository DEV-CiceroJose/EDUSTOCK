# EduStock — Redesign dos apps de PIN (app-cozinha + app-alunos)

## 1. Contexto

`app-cozinha/` e `app-alunos/` são dois mini-SPAs React independentes (Vite, sem
compartilhar código entre si nem com `frontend/`), usados em tablets/celulares
como quiosque: login por PIN numérico de 4 dígitos, uma tela de ação principal,
uma tela de resultado. Ver `PROJETO.md` §5 para o papel de cada um no sistema.

Levantamento do estado atual (2026-07-17):

- Os dois duplicam os mesmos tokens de cor num `index.css` próprio, mas sem o
  token `--color-accent`/`--color-accent-tint` que `frontend/index.css` já tem.
- Ambos usam muito `style={{}}` inline em vez de classes reutilizáveis —
  `ProducaoView.jsx` (app-cozinha) e `ContagemView.jsx` (app-alunos) são os
  piores casos.
- Ícones são emoji (🍽️ 🏫 ✅ ⚠️ ⌫) e um `IconeCategoria` com SVG escrito à mão
  em `ProducaoView.jsx:34-63`.
- Nenhum dos dois tem timeout de inatividade — uma vez logado, a sessão fica
  válida até o token expirar no backend (TTL de `OPERACAO_TOKEN_TTL_HORAS`) ou
  até alguém tocar "Sair" manualmente. Em tablet compartilhado numa cozinha ou
  sala de aula, isso é uma janela real de uso indevido.
- Falha de rede hoje só aparece como texto simples; só `carregarPlano` (app-
  cozinha) tem botão de "tentar novamente" — o resto não trata o caso.
- Nenhum dos dois tem infraestrutura de teste (Vitest/Testing Library), ao
  contrário de `frontend/` (57 testes).

Este documento cobre exclusivamente esses dois apps. Não altera `frontend/`
nem o backend, exceto onde indicado explicitamente como decisão de design que
depende de um comportamento de backend já existente (§4).

## 2. Objetivo

Redesenhar os dois apps em três frentes, sem introduzir um pacote de UI
compartilhado entre eles (decisão explícita — ver §7):

1. **Identidade visual** consistente com `frontend/`, mas com um acento
   próprio por app.
2. **Segurança/UX de tablet compartilhado** — logout automático por
   inatividade.
3. **Robustez de rede** — retry automático onde é seguro, bloqueio de duplo
   envio, e uma resposta clara para o único fluxo onde retry automático seria
   perigoso.

## 3. Identidade visual

### 3.1 Tokens

Cada app adiciona ao seu `@theme` (em `index.css`) os tokens que faltam para
alinhar com `frontend/index.css`:

```css
--color-accent: #e07a3e;
--color-accent-tint: #fbe9d9;
```

- **app-cozinha**: cor primária de ação (botão "Dar Baixa de Produção",
  cabeçalho, `numkey-confirm`, ícone de header) passa a usar `--color-accent`
  em vez de `--color-brand`.
- **app-alunos**: mantém `--color-brand` (sálvia) como está hoje.
- Motivo: os dois tablets ficam visualmente diferenciáveis à distância
  (laranja = cozinha, sálvia = alunos), sem quebrar a sensação de "mesmo
  sistema" — a paleta de base, tipografia e formas continuam idênticas às do
  dashboard admin.

### 3.2 Componentes e estilo

Substituir `style={{}}` inline por classes Tailwind utilitárias + um pequeno
conjunto de classes locais em cada `index.css`, nomeadas como as de
`frontend/index.css` (`.btn-primary` já existe como `.btn-action.btn-primary`
— mantém, mas os blocos de texto/cards com `style={{}}` viram `.card-flat`,
`.tag`, etc., replicando a nomenclatura). Isso não é extração de código: é o
mesmo vocabulário de classes reescrito em cada projeto.

Arquivos com maior volume de inline style a converter:
- `app-cozinha/src/ProducaoView.jsx` (todo o `ModalBaixa`, `ModalResultado`,
  header e footer)
- `app-alunos/src/ContagemView.jsx` (telas de sucesso e erro)

### 3.3 Ícones

Adicionar `lucide-react` como dependência nos dois `package.json`. Substituir:

| Uso atual | Ícone Lucide |
|---|---|
| 🍽️ (header cozinha) | `ChefHat` |
| 🏫 (header alunos) | `School` |
| ✅ (resultado ok) | `CheckCircle2` |
| ⚠️ / ⚠ (erro, alerta) | `AlertTriangle` |
| ⌫ (apagar dígito) | `Delete` |
| `IconeCategoria` "alimento" | `UtensilsCrossed` |
| `IconeCategoria` "limpeza" | `Droplets` |
| `IconeCategoria` padrão | `Package` |

`IconeCategoria` em `ProducaoView.jsx` deixa de ter SVG inline e passa a
mapear `nome` para um desses três componentes Lucide.

## 4. Logout por inatividade

Hook local `useIdleLogout(minutosInatividade)`, implementado em cada app (não
compartilhado — ver §7), usado em `App.jsx` envolvendo as rotas protegidas:

- Escuta `pointerdown`, `touchstart`, `keydown` no `window` (captura qualquer
  interação, não só clique em botão).
- Reseta um `setTimeout` a cada evento.
- Ao expirar: chama `logout()` (já existe em `api.js` de cada app) e navega
  para `/login` com `replace: true` — **logout completo**, não uma tela de
  bloqueio local. Qualquer estado não confirmado (número digitado, modal
  aberto) se perde; é aceitável porque a reentrada é rápida (4 dígitos).
- Duração configurável via `import.meta.env.VITE_IDLE_TIMEOUT_MIN`, com
  default `5` (minutos) se a variável não estiver setada.
- O hook só roda dentro do componente protegido (`ProducaoView`,
  `ContagemView`) — a tela de PIN não precisa de timeout, já é a tela de
  entrada.

## 5. Robustez de rede

### 5.1 Achado importante: nem toda escrita é segura para retry

- `registrarContagem` (app-alunos) **é seguro para retry automático**: o
  backend tem constraint única em `FrequenciaDiaria` e devolve `409` numa
  segunda tentativa idêntica (`core/operacao_views.py:143-151`, coberto por
  `core/tests/test_operacao_spec.py` e `test_operacao.py:120`). Reenviar não
  duplica dado — na pior hipótese, o usuário vê "já registrado".
- `baixaProducao` (app-cozinha) **não é seguro**: `baixa_de_producao` em
  `core/operacao.py:70-117` cria uma `Movimentacao` de saída para cada item a
  cada chamada, sem nenhuma deduplicação. Se a resposta se perder na rede
  (ex: timeout depois do servidor já ter processado) e o cliente reenviar
  sozinho, o estoque é debitado duas vezes. Isso é uma decisão de backend que
  este redesign não altera — o cliente precisa se comportar como se a escrita
  pudesse já ter acontecido.

### 5.2 Regra de retry em `api.js`

`req(method, path, body, { retry })` de cada app ganha um parâmetro opcional
de retry (default `false`):

- **GET** (`getPlano`, sessão): sempre seguro, `retry: true` por padrão —
  2 tentativas extras com backoff (~500ms, depois ~1500ms), só para erros de
  rede/timeout (não para respostas HTTP de erro de aplicação, tipo 4xx).
- **`registrarContagem`**: chamada com `retry: true` — mesmo raciocínio do
  GET, protegido pelo `409` do backend.
- **`baixaProducao`**: chamada com `retry: false` (explícito no call site, não
  só o default, para deixar a decisão visível a quem for ler o código depois).
  Em caso de falha de rede: mostrar mensagem clara ("Não foi possível
  confirmar se a baixa foi registrada — o plano foi recarregado, confira o
  saldo antes de tentar de novo") e chamar `carregarPlano()` automaticamente,
  para o usuário decidir visualmente se repete a ação. Sem retry silencioso.

### 5.3 Bloqueio de duplo envio

Guarda por `useRef` (não só `useState`) nos handlers de submit
(`executarBaixa`, `confirmar` em `ContagemView`), checada e setada de forma
síncrona no início da função — protege contra um segundo toque disparado
antes do primeiro `setState(loading, true)` re-renderizar o botão como
`disabled`.

## 6. Testes

Adicionar Vitest + Testing Library aos dois apps (mesma stack de
`frontend/`), escopo limitado à lógica nova de risco, não uma suíte E2E:

- `useIdleLogout`: fake timers — dispara logout após o tempo configurado sem
  eventos de interação; não dispara se houver interação antes do prazo.
- `req()` de `api.js`: fetch mockado — confirma retry em falha de rede quando
  `retry: true`, confirma ausência de retry quando `retry: false` ou
  omitido, confirma que erro HTTP de aplicação (4xx) nunca é retentado mesmo
  com `retry: true`.

## 7. Fora de escopo (decisão explícita, não esquecimento)

- **Pacote de UI compartilhado entre os dois apps** (dívida técnica T3.2 da
  auditoria, `docs/SPEC_MELHORIAS_EDUSTOCK.md`). Os dois apps continuam
  duplicando `PinLogin`, teclado numérico, cliente HTTP e hook de idle —
  agora consistentes entre si, mas fisicamente separados. Motivo: escopo
  deste projeto é visual + segurança + robustez, não arquitetura de
  compartilhamento; extrair um pacote exigiria tooling de workspace que
  nenhum dos três frontends usa hoje.
- **Indicador visual de conectividade** (banner online/offline via eventos
  `online`/`offline` do navegador) — não priorizado nesta rodada.
- **Tela de bloqueio local preservando estado** — descartada em favor de
  logout completo (mais simples de implementar e auditar; ver §4).
- Qualquer mudança em `frontend/` ou no backend além do já documentado em
  §5.1 como contexto necessário.

## 8. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Retry automático em `baixaProducao` causaria débito duplo de estoque se ativado por engano | Alto | Call site passa `retry: false` explicitamente (§5.2); teste unitário cobre a ausência de retry para essa chamada |
| Logout completo por inatividade interrompe um fluxo em andamento (ex: cozinheiro no meio de ler o plano) | Baixo-Médio | Default de 5 min é configurável por escola via `VITE_IDLE_TIMEOUT_MIN`; reentrada é rápida (4 dígitos) |
| Troca de `--color-brand` para `--color-accent` no app-cozinha pode exigir ajuste de contraste em elementos que assumiam a cor sálvia (ex: `pin-dot`, `numkey-confirm`) | Baixo | Revisar visualmente todos os usos de `--color-brand` no app-cozinha durante a implementação, não só os builds citados neste documento |
| Adicionar Vitest aos dois apps aumenta levemente o tempo de CI/build | Baixo | Escopo de teste é pequeno (2 utilitários), não uma suíte completa |

## 9. Critérios de aceitação

1. app-cozinha usa laranja (`--color-accent`) como cor de ação primária;
   app-alunos mantém sálvia — visualmente distinguíveis lado a lado.
2. Nenhum emoji restante nos dois apps; todos os ícones vêm de `lucide-react`.
3. Deixar um tablet logado sem interação por mais que `VITE_IDLE_TIMEOUT_MIN`
   minutos (ou o default de 5) desloga automaticamente e volta pra tela de
   PIN.
4. Simular falha de rede (offline) em `getPlano`/`registrarContagem` resulta
   em nova tentativa automática antes de mostrar erro; a mesma simulação em
   `baixaProducao` nunca reenvia sozinho.
5. Dois toques rápidos no botão de confirmar (baixa ou contagem) nunca geram
   duas requisições.
6. `npm test` roda e passa nos dois apps, cobrindo `useIdleLogout` e o
   comportamento de retry de `req()`.
