# Resultado da Fase 1 — App Alunos

Data da conclusão: 1 de agosto de 2026.

## Escopo entregue

A Fase 1 fortaleceu o fluxo de autenticação e registro de presença do
`app-alunos`, sem alterar funcionalidades do painel principal ou iniciar o
escopo do App Cozinha.

### Sessão e autenticação

- A rota protegida agora exige, ao mesmo tempo, token operacional e metadados
  válidos de representante de turma.
- Metadados incompletos, inválidos ou antigos são removidos antes do
  redirecionamento para o PIN.
- A resposta do login é validada antes de ser gravada no navegador.
- O logout limpa a sessão local imediatamente e também invalida o token no
  endpoint `/api/operacao/auth/logout/`.
- Uma resposta HTTP 401 durante o registro encerra a sessão e retorna ao PIN
  com a mensagem de que a sessão expirou.

### Registro de presença

- O limite de quatro dígitos da interface passou a ter a mesma validação no
  backend: são aceitos valores inteiros entre 1 e 9999.
- O conflito de frequência já registrada continua retornando HTTP 409 e agora
  também inclui o código estável `frequencia_duplicada`.
- Falhas de conexão exibem uma orientação simples para verificar a internet e
  tentar novamente.
- O redirecionamento de sessão ausente deixou de ocorrer durante a renderização
  do componente.
- O espaço vazio e a tecla 9 do teclado numérico deixaram de compartilhar a
  mesma identificação interna.

### Acessibilidade e configuração

- As telas de sucesso, erro e aviso de sessão usam regiões semânticas para
  leitores de tela.
- O valor digitado no teclado numérico é anunciado de forma apropriada.
- A página volta a permitir zoom pelo navegador.
- A variável `VITE_IDLE_TIMEOUT_MIN=5` foi registrada no `.env.example`.

## Decisões preservadas

- Quantidade zero continua inválida. Alterar essa regra exige uma decisão de
  negócio sobre turmas sem presença.
- A interface do aluno continua enviando o registro para o dia atual. O backend
  mantém compatibilidade com uma data explícita para integrações e testes; uma
  restrição adicional depende de decisão de negócio.
- Uma segunda frequência para a mesma turma, turno e data continua bloqueada,
  inclusive quando a quantidade informada é igual.

## Testes adicionados

- Persistência e validação de sessão completa.
- Limpeza de metadados sem token.
- Invalidação remota e limpeza local no logout.
- Retorno ao PIN após HTTP 401.
- Mensagem amigável em falha de conexão.
- Aviso de sessão expirada no login.
- Rejeição backend de quantidade acima de 9999.
- Código estável no conflito de frequência duplicada.
- Fluxos E2E para sessão incompleta e sessão expirada durante o envio.

O arquivo `frontend/e2e/alunos.spec.ts` foi alterado somente para ampliar a
cobertura automatizada do sub-app. Nenhuma funcionalidade do painel principal
foi modificada.

## Validações executadas

- Backend operacional: 38 testes aprovados.
- App Alunos: 19 testes aprovados.
- E2E do projeto `alunos`: 3 cenários aprovados.
- Build de produção do App Alunos: aprovado.
- Regressão do App Cozinha: 13 testes e build aprovados após a mudança aditiva
  no componente de login compartilhado.
- Verificação de migrations: nenhuma alteração pendente.

## Próximo passo

A Fase 2 — App Cozinha só deve começar após autorização explícita do usuário.
