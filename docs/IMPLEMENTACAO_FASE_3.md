# Implementação da Fase 3

## Redução de código legado

- As views HTML antigas de produtos e categorias, seus formulários, templates e
  rotas foram removidos. O dashboard React e a API REST são agora os únicos
  fluxos administrativos.
- `Tabs.jsx` e `config-demo.js`, que não tinham consumidores, foram removidos.
- O `KitchenPanel` com contagem fixa foi retirado. A página de merenda mantém o
  `ContagemWidget`, que consulta o resumo real do backend.
- O modelo `Perfil` antigo do app `core` já havia sido removido pela migration
  `0015`. O modelo homônimo de `plataforma` foi preservado porque controla os
  papéis de acesso atuais.

## Código compartilhado

O pacote local `@edustock/operacao-shared` concentra:

- teclado e fluxo de autenticação por PIN;
- cliente HTTP, header de operação e política de retry;
- tokens de cor, tipografia, status e sombras.

Os apps Alunos e Cozinha mantêm somente suas regras de domínio, textos, ícones e
destinos de navegação. A validação local opcional do PIN da cozinha foi removida;
a decisão de autenticação fica exclusivamente no backend.

## Banco e API

- Todos os `ModelViewSet` usam paginação com 100 itens por padrão.
- O parâmetro `page_size` permite até 500 itens.
- O cliente administrativo percorre todas as páginas automaticamente, mantendo
  o contrato de array usado pelas telas.
- Foram adicionados índices em `Produto.validade`, `Movimentacao.data` e
  `Movimentacao.tipo` pela migration `0017`.

## Confiabilidade do frontend

- `useDashboardData` separa a busca de produtos das consultas estáticas.
- Respostas obsoletas são ignoradas ao desmontar ou trocar a busca.
- Falhas de carregamento são expostas pelo hook e exibidas nas páginas com ação
  de nova tentativa.
- Formulários modais reinicializam por montagem, sem efeitos de atualização
  síncrona.
- O contexto de toast foi separado do componente para preservar Fast Refresh.
- O lint do painel passou de 33 ocorrências para zero.

## Observabilidade e integração contínua

- Rejeições de movimentação, saldo insuficiente e entradas vazias geram logs sem
  expor credenciais.
- O workflow `.github/workflows/ci.yml` executa migrações, testes do Django,
  lint, testes e builds dos três frontends.
- Para bloquear deploys com CI vermelho, configure os jobs do workflow como
  verificações obrigatórias na proteção da branch principal do GitHub.
