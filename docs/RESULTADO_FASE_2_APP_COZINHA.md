# Resultado da Fase 2 — App Cozinha

Data da conclusão: 1 de agosto de 2026.

## Escopo entregue

A Fase 2 tornou a baixa de produção rastreável e segura contra repetição,
concorrência, perda de resposta e saldo insuficiente. O trabalho foi realizado
na branch `new/subapps-fases-2-3`.

## Idempotência e concorrência

- Cada baixa recebe um UUID no campo `operacao_id`.
- O identificador pendente permanece no `sessionStorage` até a confirmação do
  resultado.
- Repetir o mesmo payload com o mesmo identificador retorna o resultado
  anterior e não cria novas movimentações.
- Reutilizar o identificador com outra data, refeição ou lista de itens retorna
  HTTP 409 com o código `operacao_id_reutilizado`.
- A operação e as movimentações são processadas em uma transação. Os produtos
  continuam bloqueados individualmente durante a atualização do saldo.
- Uma exceção não tratada desfaz a operação inteira, permitindo uma repetição
  segura; falhas de estoque previstas são registradas no resultado parcial.

Foi criado o modelo `OperacaoBaixaProducao`, com migrations próprias, para
guardar data, refeição, itens solicitados, status e resultado final.
As operações podem ser consultadas no Django Admin em modo somente leitura.

## Contrato da API

### Registrar ou repetir uma baixa

`POST /api/operacao/baixa-de-producao/`

Payload obrigatório:

```json
{
  "operacao_id": "UUID",
  "data": "AAAA-MM-DD",
  "refeicao": "ALMOCO"
}
```

O campo `itens` permanece opcional e, quando informado, aceita apenas
`produto_id` e `quantidade_override` positiva. Produtos repetidos e campos não
reconhecidos são rejeitados com HTTP 400.

### Consultar uma baixa

`GET /api/operacao/baixa-de-producao/?operacao_id=UUID`

- Retorna o resultado persistido quando a operação existe.
- Retorna HTTP 404 e `operacao_nao_encontrada` quando ainda não existe.
- Permite reconciliar uma baixa quando o envio foi concluído no servidor, mas
  a resposta não chegou ao dispositivo.

## Regras formalizadas

- Baixas de estoque só podem ser registradas na data atual.
- Cada turma possui exclusivamente o período integral e registra uma única
  frequência diária.
- A cozinha possui três operações independentes por dia: `CAFE_MANHA`,
  `ALMOCO` e `LANCHE_TARDE`.
- Cada refeição aceita no máximo uma baixa por data. Uma nova tentativa com
  outro identificador retorna `refeicao_ja_baixada` sem alterar o estoque.
- Consultar o plano continua sendo uma operação somente de leitura.
- A baixa é parcial por item: produtos com saldo suficiente são processados e
  produtos insuficientes permanecem inalterados, aparecendo como falha.
- Se nenhum item tiver saldo disponível, a interface não libera a confirmação.
- O bloqueio de linha do produto continua impedindo saldo negativo em
  solicitações concorrentes.

## Interface do App Cozinha

- O modal de confirmação mostra data, refeição, produtos, quantidades e itens com
  estoque insuficiente.
- A política de baixa parcial é explicada antes da confirmação.
- Foi adicionado botão de atualização manual e horário da última sincronização.
- Se a resposta do POST se perder, o app consulta o resultado pelo UUID antes
  de orientar uma nova tentativa.
- Erros HTTP 401 e 403 encerram a sessão local e retornam ao PIN com mensagem
  adequada.
- O logout invalida o token no servidor e limpa a sessão local imediatamente.
- Modais possuem semântica de diálogo, foco inicial e fechamento pela tecla
  Escape.
- Estados de carregamento e erro possuem anúncios semânticos.
- O tempo de inatividade foi registrado no `.env.example`.

## Testes adicionados

- Repetição idempotente sem nova movimentação ou novo desconto.
- Consulta do resultado anterior pelo identificador.
- Bloqueio de reutilização do UUID com payload diferente.
- Validação de UUID obrigatório e bloqueio de data histórica.
- Persistência e renovação do identificador pendente no app.
- Envio do UUID no payload e consulta posterior.
- Reconciliação automática após perda da resposta.
- Conteúdo e acessibilidade do modal de confirmação.
- Atualização manual e informação da última sincronização.
- E2E de baixa parcial, reconciliação e sessão expirada.

## Validações executadas

- App Cozinha: 22 testes aprovados.
- Backend operacional: 43 testes aprovados.
- E2E do projeto `cozinha`: 3 cenários aprovados.
- Build de produção do App Cozinha: aprovado.
- Verificação de models e migrations: aprovada, sem divergências.
- Verificação do Django: aprovada.

## Próximo passo

A Fase 3 — revisão e melhorias simples — deve usar esta mesma branch e só pode
começar após autorização explícita do usuário.
