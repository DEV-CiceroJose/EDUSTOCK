# Implementação das fases 1 e 2

Este documento registra as melhorias efetivamente implementadas na branch
`new/melhorias-fases-1-2`.

## Fase 1 — segurança e autenticação

- A API administrativa passou a exigir autenticação para escrita e a distinguir
  operações de leitura das operações exclusivas de administrador.
- O dashboard ganhou login, sessão em `sessionStorage`, proteção de rotas e
  encerramento de sessão sem apagar dados não relacionados do navegador.
- PINs deixaram de ser armazenados em texto puro. A validação usa hash e uma
  impressão digital protegida para impedir duplicidades.
- O login por PIN passou a ter limitação de tentativas, bloqueio temporário e
  registro de falhas.
- Sessões dos apps operacionais foram movidas da memória do processo para o
  cache compartilhado. Redis pode ser usado em produção; o banco é o fallback.
- Configurações inseguras de produção foram removidas: chave secreta obrigatória,
  `DEBUG` desligado por padrão e cookies/HTTPS endurecidos em produção.
- O resumo operacional passou a exigir uma sessão válida.
- Migração e testes de regressão foram adicionados.

## Fase 2 — estabilização do produto

- Os controles da página Configurações agora têm efeito real:
  - modo mock seleciona a camada de dados na próxima inicialização;
  - prazo de validade é enviado à API e também respeitado pelo mock;
  - densidade altera a grade e o tamanho dos cards.
- A navegação mobile passou a usar um menu lateral funcional, com fundo de
  bloqueio, fechamento por clique, navegação e tecla `Escape`.
- Modais agora identificam corretamente o diálogo, prendem o foco, fecham com
  `Escape`, restauram o foco anterior e bloqueiam a rolagem do fundo.
- Toasts anunciam mensagens por região acessível.
- A interface esconde cadastro, edição e exclusão para operadores, mantendo
  disponíveis as movimentações de entrada e saída.
- Todos os modelos de negócio foram registrados no Django Admin. Entradas e
  movimentações são somente leitura para preservar o histórico.
- A variável do dashboard em produção foi padronizada como `VITE_API_URL`,
  incluindo o caminho `/api`.
- Dependências do frontend receberam atualizações compatíveis identificadas
  pelo auditor de pacotes.
- Foram adicionados testes para configurações, alertas, permissões, menu mobile,
  modais, toasts e Django Admin.

## Verificação

- Backend: suíte Django completa e checagem de deploy. O único aviso restante
  é o `HSTS preload`, mantido opt-in porque sua ativação exige uma decisão de
  domínio e tem efeito duradouro nos navegadores.
- Frontend administrativo: suíte Vitest completa e build de produção.
- Migrações: nenhuma alteração pendente fora da migração incluída na Fase 1.

As vulnerabilidades restantes apontadas pelo auditor do npm pertencem à cadeia
React Router/RSC. A correção automática disponível exige mudança incompatível;
como este dashboard é uma SPA e não usa React Server Components, a atualização
forçada foi evitada e deve ser reavaliada quando houver versão compatível.

O lint ainda reporta 33 ocorrências herdadas, concentradas em regras novas de
hooks, escopo global dos testes e exports para Fast Refresh. Elas não impedem os
testes nem o build e ficam registradas como dívida técnica para a próxima fase.
