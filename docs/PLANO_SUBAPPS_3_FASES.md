# Plano de evolução dos sub-apps do EDUSTOCK

Este documento é um handoff completo para uma nova sessão de trabalho. Ele
deve ser lido antes de qualquer alteração no repositório.

## Contexto obrigatório

- Repositório: `https://github.com/DEV-CiceroJose/EDUSTOCK.git`
- Sub-apps deste plano:
  - `app-alunos`: registro de presença por representantes de turma.
  - `app-cozinha`: plano de produção e baixa de estoque pela cozinha.
- Backend compartilhado: Django/DRF em `core/`.
- Pacote compartilhado: `packages/operacao-shared/`.
- O painel principal em `frontend/` está fora do escopo de implementação deste
  plano. Ele pode ser consultado apenas para entender contratos já existentes.
- Não alterar `frontend/` por iniciativa própria.
- Não instalar dependências sem necessidade comprovada.
- Não implementar uma fase seguinte sem aprovação explícita do usuário.
- Ao terminar cada fase, explicar o que foi feito, o que mudou, quais testes
  passaram e perguntar se pode iniciar a próxima fase.

## Estado inicial conhecido

Antes de começar, confirmar o estado atual com:

```powershell
git status -sb
git branch --show-current
git log -5 --oneline
```

O trabalho anterior foi realizado na branch `new/melhorias-fases-1-2`. O último
commit conhecido é `0023f2a feat: integra grupos e alertas ao estoque`, mas a
branch e os PRs devem ser conferidos novamente no GitHub antes de qualquer
decisão.

Os dois sub-apps já possuem:

- React + Vite;
- `lucide-react`;
- Vitest + Testing Library;
- logout automático por inatividade;
- cliente HTTP compartilhado;
- autenticação por PIN no endpoint `/api/operacao/auth/`;
- tokens operacionais enviados por `X-Operacao-Token`;
- testes unitários de API, login e inatividade;
- builds independentes.

Arquivos centrais:

- `app-alunos/src/App.jsx`
- `app-alunos/src/PinLogin.jsx`
- `app-alunos/src/ContagemView.jsx`
- `app-alunos/src/api.js`
- `app-cozinha/src/App.jsx`
- `app-cozinha/src/PinLogin.jsx`
- `app-cozinha/src/ProducaoView.jsx`
- `app-cozinha/src/api.js`
- `packages/operacao-shared/src/OperationPinLogin.jsx`
- `packages/operacao-shared/src/operacaoHttpClient.js`
- `core/operacao_auth.py`
- `core/operacao_views.py`
- `core/operacao.py`
- `core/services.py`
- `core/models.py`

## Como começar uma nova sessão

1. Ler este documento inteiro.
2. Conferir branch, status do Git e commits recentes.
3. Ler os arquivos do sub-app correspondente à fase atual.
4. Ler os endpoints e serviços backend usados por esse sub-app.
5. Executar os testes atuais antes de alterar qualquer coisa.
6. Registrar os resultados e eventuais falhas preexistentes.
7. Escrever um plano curto da fase antes de implementar.
8. Implementar somente o escopo da fase aprovada.
9. Rodar os testes, build e verificações de diff.
10. Documentar o resultado e pedir autorização para continuar.

Comandos de validação básicos:

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test core.tests.test_operacao core.tests.test_operacao_spec

Push-Location app-alunos
npm test -- --run
npm run build
Pop-Location

Push-Location app-cozinha
npm test -- --run
npm run build
Pop-Location

git diff --check
```

---

# Fase 1 — App Alunos

## Objetivo

Tornar o registro de presença mais seguro, previsível e acessível sem mudar o
objetivo do app: o representante entra com PIN, informa a presença da turma e
recebe confirmação.

## Fluxo atual

1. `/login` mostra teclado de PIN com quatro dígitos.
2. O quarto dígito dispara `POST /api/operacao/auth/` com perfil `ALUNO_REP`.
3. O backend retorna token, turma e turno.
4. O app salva o token e a sessão em `sessionStorage`.
5. `/registrar` mostra turma, turno e teclado numérico.
6. `POST /api/operacao/contagem/` registra a presença.
7. HTTP 409 informa que a contagem já foi registrada.
8. A sessão expira por inatividade ou logout manual.

## Evidências a analisar

- `app-alunos/src/App.jsx`
- `app-alunos/src/PinLogin.jsx`
- `app-alunos/src/ContagemView.jsx`
- `app-alunos/src/api.js`
- `app-alunos/src/useIdleLogout.js`
- `app-alunos/src/index.css`
- `app-alunos/src/*.test.*`
- `core/operacao_views.py`, classe `ContagemView`
- `core/operacao_auth.py`, função `requer_perfil_operacao`
- `core/models.py`, modelo `FrequenciaDiaria`
- `core/services.py`, função `calcular_previsao_producao`

## Trabalho esperado

### Prioridade P0/P1

1. Verificar se a guarda de rota confirma simultaneamente token e dados da
   sessão.
2. Tratar HTTP 401 como sessão expirada, limpando o token e retornando ao
   login com mensagem clara.
3. Definir com o usuário se presença zero é válida. Não assumir a regra sem
   confirmação, porque hoje frontend e backend rejeitam zero.
4. Avaliar o limite máximo de alunos aceito pelo backend. O frontend limita o
   teclado a quatro dígitos, mas a API deve possuir sua própria validação.
5. Definir se o campo `data` deve aceitar somente o dia atual.
6. Melhorar o tratamento de uma contagem reenviada depois de falha de rede,
   distinguindo “já registrado” de “falha desconhecida”.
7. Garantir que erros de rede e erros de negócio tenham mensagens diferentes.

### Prioridade P1/P2

8. Permitir revisão do PIN antes do envio automático, caso o usuário prefira
   esse comportamento.
9. Melhorar acessibilidade do teclado, dos indicadores de dígito e das telas
   de sucesso/erro.
10. Documentar `VITE_IDLE_TIMEOUT_MIN` nos arquivos `.env.example`.
11. Criar teste E2E do fluxo completo do app-alunos, preferencialmente junto
    ao projeto Playwright já existente.
12. Avaliar fluxo de correção de presença, somente se o usuário confirmar que
    erros de digitação precisam ser corrigidos pelo próprio app.

## Não fazer nesta fase

- Não alterar o app-cozinha.
- Não alterar o painel principal.
- Não criar ranking ou gamificação.
- Não criar modo offline sem definir antes a política de conflito.
- Não trocar React, Vite ou Django.

## Critérios de conclusão

- Login válido e inválido continuam funcionando.
- Token ausente, inválido e expirado retornam o usuário ao login.
- Contagem duplicada continua protegida pelo HTTP 409.
- Limites e regra de zero estão documentados e testados.
- Falhas de rede não criam registros duplicados.
- Testes unitários e E2E do app-alunos passam.
- Build do app-alunos passa.
- Nenhum PIN ou segredo aparece no código, bundle ou commit.
- A sessão termina com resumo dos arquivos alterados, testes executados e
  riscos restantes.

## Commit da fase

Usar uma mensagem humana e específica, por exemplo:

```text
fix(app-alunos): fortalece sessão e registro de presença
```

O commit deve ser atribuído à conta/autoria configurada de
`DEV-CiceroJose`. Não inserir nomes de ferramentas, assistentes ou autores
que não pertençam ao projeto.

Depois do commit, parar e pedir aprovação para iniciar a Fase 2.

---

# Fase 2 — App Cozinha

## Objetivo

Tornar o plano de produção e a baixa de estoque confiáveis em situações de
concorrência, falha de rede e estoque insuficiente.

## Fluxo atual

1. `/login` recebe PIN de perfil `COZINHA`.
2. `/producao` determina data atual e turno padrão.
3. `GET /api/operacao/plano-do-dia/` calcula o plano com base na frequência,
   nos fatores de consumo e no estoque atual.
4. A tela mostra quantidade necessária e estoque insuficiente.
5. O usuário confirma “Dar Baixa de Produção”.
6. `POST /api/operacao/baixa-de-producao/` cria as movimentações.
7. O resultado separa sucessos e falhas por produto.

## Evidências a analisar

- `app-cozinha/src/App.jsx`
- `app-cozinha/src/PinLogin.jsx`
- `app-cozinha/src/ProducaoView.jsx`
- `app-cozinha/src/api.js`
- `app-cozinha/src/useIdleLogout.js`
- `app-cozinha/src/index.css`
- `app-cozinha/src/*.test.*`
- `core/operacao_views.py`, classes `PlanoDoDiaView` e `BaixaProducaoView`
- `core/operacao.py`, funções `gerar_plano_do_dia` e `baixa_de_producao`
- `core/services.py`, funções de frequência e previsão
- `core/models.py`, modelos `FatorConsumo`, `Produto` e `Movimentacao`

## Trabalho esperado

### Prioridade P0

1. Implementar idempotência da baixa de produção.
   - Cada operação deve possuir identificador único.
   - Repetir a mesma operação não pode criar nova movimentação.
   - A resposta deve permitir consultar o resultado anterior.
2. Validar o payload de baixa com serializer/schema explícito.
3. Impedir ou controlar datas históricas e futuras conforme regra aprovada.
4. Garantir que uma baixa concorrente não gere saldo negativo.

### Prioridade P1

5. Definir formalmente se a baixa é parcial por item ou atômica por ordem.
6. Adicionar atualização manual do plano e informação de última sincronização.
7. Tratar 401 e 403 de forma consistente, incluindo módulo desativado.
8. Criar E2E próprio para login, carregamento, estoque insuficiente, modal,
   baixa e resultado parcial.
9. Melhorar a confirmação para mostrar data, turno e itens que serão baixados.
10. Validar todos os itens insuficientes antes de permitir a confirmação.

### Prioridade P2

11. Avaliar consulta de datas futuras, se o negócio exigir planejamento.
12. Avaliar fatores por cardápio, turno ou receita.
13. Adicionar status de operação: planejada, iniciada, concluída, parcial ou
    pendente de revisão.
14. Adicionar auditoria do titular do PIN ou de uma identificação operacional.
15. Melhorar acessibilidade dos modais com `role="dialog"`, foco controlado,
    Escape e anúncios para leitores de tela.

## Não fazer nesta fase

- Não alterar o app-alunos.
- Não alterar o painel principal.
- Não ativar retry automático na baixa sem idempotência comprovada.
- Não criar receitas complexas sem validar o modelo de negócio.
- Não fazer migração de dados sem plano de rollback.

## Critérios de conclusão

- Repetir uma requisição de baixa não duplica movimentações.
- Payload inválido retorna erro controlado, nunca erro 500.
- Concorrência e saldo insuficiente são cobertos por testes.
- O usuário sabe qual data, turno e itens estão sendo baixados.
- Falha de rede informa se a operação é desconhecida e permite reconciliação.
- E2E do app-cozinha passa.
- Build e testes do app-cozinha passam.
- Backend e frontend permanecem compatíveis.

## Commit da fase

Exemplo de mensagem:

```text
fix(app-cozinha): torna a baixa de produção idempotente
```

O commit deve usar a autoria da conta `DEV-CiceroJose`, sem menções a
ferramentas ou autores externos ao projeto.

Depois do commit, parar e pedir aprovação para iniciar a Fase 3.

---

# Fase 3 — Revisão e melhorias simples

## Objetivo

Revisar os dois sub-apps depois das correções críticas e aplicar melhorias
pequenas, sem iniciar uma reconstrução arquitetural.

## Escopo

### Consistência compartilhada

- Conferir `OperationPinLogin` nos dois apps.
- Conferir tratamento de erros do cliente HTTP.
- Conferir nomes de turnos, mensagens e estados.
- Conferir tokens de design.
- Conferir timeout e logout.
- Conferir comportamento em 401, 403, 409 e falha de rede.

### Acessibilidade e interface

- Corrigir labels, foco e estados anunciados.
- Revisar contraste sem depender apenas de cor.
- Conferir tablet, celular e desktop.
- Corrigir modais e botões semânticos.
- Reduzir os estilos inline mais repetitivos.
- Revisar dependências e bundles sem trocar a stack.

### Documentação e operação

- Atualizar `documentation.md` com o pacote compartilhado atual.
- Atualizar `.env.example` com as variáveis realmente usadas.
- Documentar os endpoints operacionais e seus códigos de erro.
- Documentar tempo de sessão e comportamento de inatividade.
- Documentar smoke tests pós-deploy.
- Registrar riscos restantes e decisões de negócio.

### Testes

- Rodar testes unitários dos dois apps.
- Rodar testes backend do módulo operacional.
- Rodar E2E dos dois apps.
- Rodar builds dos dois apps.
- Rodar `git diff --check` e validação de migrations.
- Testar manualmente os fluxos em viewport de tablet.

## Não fazer nesta fase

- Não alterar funcionalidades grandes.
- Não criar gamificação.
- Não criar microfrontends.
- Não trocar tecnologia.
- Não incluir ideias ou melhorias do painel principal.
- Não misturar novas regras de negócio com limpeza visual.

## Critérios de conclusão

- Os dois apps têm comportamento consistente nos mesmos estados.
- A documentação não contradiz o código.
- Não existem segredos ou PINs no bundle.
- Os testes e builds passam.
- O resultado visual foi conferido em tablet e desktop.
- O relatório final lista melhorias simples, riscos remanescentes e itens
  explicitamente deixados para uma próxima etapa.

## Commit da fase

Exemplo de mensagem:

```text
chore(subapps): revisa consistência e documentação operacional
```

Usar somente a autoria da conta `DEV-CiceroJose`.

---

# Regras de Git e publicação

1. Não executar `reset --hard`, `checkout --` ou remoções destrutivas.
2. Conferir `git status` antes de cada commit.
3. Não adicionar arquivos fora do escopo da fase.
4. Não gravar PINs, tokens, senhas ou segredos em arquivos.
5. Usar mensagens de commit humanas e específicas.
6. A autoria deve ser a conta/configuração de `DEV-CiceroJose`.
7. Nunca incluir no commit nomes de ferramentas, assistentes ou autores que
   não sejam do projeto.
8. Não fazer push sem confirmação do usuário para aquele momento.
9. Não abrir ou alterar PR sem confirmar a branch e o escopo.
10. Ao publicar, informar branch, commit, PR, testes e status do CI.

# Checklist de encerramento de qualquer fase

- [ ] Escopo da fase respeitado.
- [ ] Nenhum arquivo do painel principal alterado sem autorização.
- [ ] Testes específicos executados.
- [ ] Build executado.
- [ ] `git diff --check` aprovado.
- [ ] Migrations verificadas, quando backend foi alterado.
- [ ] Nenhum segredo exposto.
- [ ] Commit atribuído a `DEV-CiceroJose`.
- [ ] Alterações descritas em linguagem clara.
- [ ] Riscos e pendências documentados.
- [ ] Usuário consultado antes da próxima fase.
