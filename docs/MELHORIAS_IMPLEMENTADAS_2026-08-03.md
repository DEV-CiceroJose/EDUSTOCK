# Melhorias implementadas em 03/08/2026

## Segurança e permissões

- Tokens administrativos são persistidos somente como SHA-256; o valor claro é entregue uma única vez no login.
- O login administrativo bloqueia temporariamente após cinco falhas na mesma combinação de usuário e endereço de origem.
- O módulo financeiro é aplicado no backend: preços e totais são removidos das respostas quando o usuário não possui acesso.
- Operadores podem receber uma lista específica de módulos; uma lista vazia preserva o comportamento anterior de acesso a todos os módulos ativos.
- Login, logout, mudanças administrativas, entradas e movimentações geram registros imutáveis de auditoria.

O deploy da migration `plataforma.0005` invalida os tokens administrativos temporários existentes. Os usuários apenas precisarão entrar novamente.

## Cardápios e receitas

O Django Admin permite cadastrar receitas, ingredientes por aluno e o cardápio de cada refeição. Quando existe cardápio para a data e refeição, o plano da cozinha usa apenas seus ingredientes. Na ausência de cardápio, os fatores de consumo antigos continuam sendo usados.

## Lotes e FEFO

Cada item de entrada pode informar código de lote e validade. Se o código não for informado, o backend cria um identificador compatível com a entrada. As saídas consomem primeiro os lotes com validade mais próxima e registram as alocações utilizadas. Estoque legado sem lote continua disponível e pode ser consumido normalmente.

## Operação offline

Os aplicativos de alunos e cozinha armazenam localmente operações que falham por indisponibilidade de rede e tentam enviá-las quando a conexão retorna. Todas as operações possuem identificador idempotente para que reenvios não dupliquem frequência ou baixa de produção.

## Implantação

- Python de produção e CI: série 3.13.
- Dependências Python fixadas nas versões validadas.
- Builds estáticos usam `npm ci`.
- Antes do deploy: criar backup, aplicar migrations e confirmar `/api/health/`.

## Compatibilidade

- Usuários existentes sem módulos associados mantêm acesso aos módulos globais ativos.
- Produtos e saldos antigos continuam válidos sem lotes.
- Fatores de consumo continuam funcionando até que cardápios sejam cadastrados.
- O primeiro acesso após o deploy exige novo login administrativo devido à rotação do formato de token.
