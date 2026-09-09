# Validação de alunos e entregas — 06/09/2026

## Atualização — 08/09/2026

A revisão independente identificou e foram corrigidos o acesso de PINs com
turma/perfil alterados e a leitura de XLSX sem dimensões declaradas. Os testes
reproduziram as falhas antes da correção. Após as correções, os 35 testes de
distribuição e estorno passaram em 101,382 segundos; a verificação de migrações
não detectou alterações pendentes. A suíte completa PostgreSQL e a conferência
visual serão verificadas na CI antes de liberar a versão online.

O escopo de publicação permanece online. A proposta offline geral foi descartada;
offline apenas nas entregas continua sendo uma evolução posterior.

Implementação local na branch `new/alunos-entregas`, baseada em `origin/main`.
O checkout original e a branch `edustock-vps` foram preservados.

## Resultados confirmados

- Django: 28 testes passaram na execução do módulo e das migrações existentes.
- Após adicionar a proteção contra estorno avulso de entregas: seis testes do
  serviço de entrega e nove testes existentes de estorno passaram.
- Migrações: `makemigrations --check --dry-run` sem alterações pendentes.
- Django `check`: sem problemas.
- React: três testes da gestão e dois dos protagonistas passaram.
- Dashboard: lint, verificação de tipos e build passaram.
- App-alunos: build passou.
- `git diff --check`: sem erros de whitespace.

## Verificação ainda pendente

A suíte visual completa em 1280 e 390 px não concluiu. Uma execução confirmou o
fluxo de entrega dos protagonistas em 1280 px. O teste da gestão inicialmente
encontrou dois botões chamados Relatório; o seletor foi corrigido para a navegação
da distribuição. Nas tentativas seguintes ocorreram timeouts, em paralelo a
erros de memória do Windows. A última tentativa com limite local de 180 segundos
foi interrompida sem resultado; os limites padrão dos testes foram preservados.
Não considerar a interface responsiva nem a exportação no navegador aprovadas.
Retomar `playwright.distribuicao.config.ts` quando houver memória disponível e
inspecionar as capturas antes da publicação.

As execuções Django usaram SQLite descartável. Não comprovam concorrência em
PostgreSQL nem integração com a VPS. As migrações não foram aplicadas à produção.

## Ambiente de validação

Trabalho em `C:\CodexWorktrees\EDUSTOCK\alunos-entregas`, fora do OneDrive.
Windows com aproximadamente 4 GB de RAM; houve falhas de memória e de partida
dos workers. Os testes React passaram quando executados separadamente com um
worker. Para a última execução Django, OpenBLAS foi limitado a uma thread apenas
no processo de teste. Não houve alteração dos limites da aplicação.

Os testes de navegador usam respostas de API simuladas; permissões e persistência
são verificadas separadamente pelos testes Django. A homologação integrada com
contas reais e PostgreSQL permanece necessária antes da publicação.

## Limites funcionais documentados

Consulte `ALUNOS_E_ENTREGAS.md`: turmas previamente cadastradas, composição de
fardamento igual por rodada, autoria por PIN/turma e ausência de cancelamento de
recebimento confirmado. Não houve publicação, push ou merge nesta etapa.
