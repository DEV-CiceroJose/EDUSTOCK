# Operação dos apps de Alunos e Cozinha

Atualizado em 2 de agosto de 2026.

## Regras vigentes

- Todas as turmas são integrais.
- Cada turma registra uma presença diária entre 1 e 45 alunos.
- A cozinha usa a soma das presenças integrais para calcular a produção.
- São permitidas três baixas por dia: café da manhã, almoço e lanche da tarde.
- Cada refeição pode ser baixada uma única vez por data.
- Uma baixa é parcial por item: itens com saldo suficiente são processados e
  itens insuficientes são informados no resultado.

## Sessão

- O login usa PIN no backend e retorna um token operacional.
- O token é enviado no header `X-Operacao-Token` e tem TTL de 12 horas.
- Os dois apps encerram a sessão após 5 minutos sem interação por padrão.
- `VITE_IDLE_TIMEOUT_MIN` aceita um número positivo de minutos.
- Sair ou atingir o limite de inatividade limpa o estado local e tenta
  invalidar o token no servidor.
- Nenhum PIN deve ficar em arquivo `.env`, código-fonte ou bundle.

## Endpoints

| Método | Endpoint | Uso |
|---|---|---|
| POST | `/api/operacao/auth/` | Login por PIN |
| DELETE | `/api/operacao/auth/logout/` | Invalidação da sessão |
| POST | `/api/operacao/contagem/` | Registro da presença integral |
| GET | `/api/operacao/contagem/` | Consulta das frequências do dia |
| GET | `/api/operacao/plano-do-dia/?data=YYYY-MM-DD&refeicao=...` | Plano da refeição |
| POST | `/api/operacao/baixa-de-producao/` | Baixa idempotente do estoque |
| GET | `/api/operacao/baixa-de-producao/?operacao_id=...` | Reconciliação de uma baixa |

Refeições aceitas: `CAFE_MANHA`, `ALMOCO` e `LANCHE_TARDE`.

## Tratamento de falhas

- `400`: dados inválidos; corrigir a requisição.
- `401`: PIN inválido ou sessão expirada; voltar ao login.
- `403`: perfil incorreto ou módulo indisponível; encerrar o acesso.
- `404 operacao_nao_encontrada`: a baixa não chegou ao servidor; o UUID
  pendente pode ser reutilizado com segurança.
- `409 frequencia_duplicada`: a turma já registrou a presença do dia.
- `409 operacao_id_reutilizado`: o UUID pertence a outro conteúdo.
- `409 refeicao_ja_baixada`: mostrar o resultado já persistido.
- `429`: aguardar o período indicado em `Retry-After` antes de novo PIN.
- Sem resposta HTTP: mostrar falha de conexão. Consultas e contagem podem ter
  retry; a baixa deve ser reconciliada pelo UUID antes de nova tentativa.

## Smoke tests depois do deploy

1. Aplicar as migrations e confirmar que não há migrations pendentes.
2. Entrar no App Alunos com um PIN de homologação e conferir `Período integral`.
3. Registrar uma presença válida e confirmar a tela de sucesso.
4. Tentar repetir a presença e conferir a mensagem de registro existente.
5. Entrar no App Cozinha com um PIN de homologação.
6. Abrir cada uma das três refeições e conferir o mesmo total integral.
7. Abrir e cancelar a confirmação de baixa sem alterar estoque.
8. Em ambiente descartável, baixar uma refeição e conferir as movimentações.
9. Atualizar a página e confirmar `Baixa já realizada` na refeição processada.
10. Conferir logout manual, expiração de sessão e mensagem de conexão offline.

## Riscos e decisões pendentes

- O mesmo `FatorConsumo` é aplicado às três refeições. Fatores específicos por
  cardápio/refeição exigem uma futura decisão de negócio.
- A política atual é baixa parcial por item. Uma ordem totalmente atômica
  exigiria outra regra operacional.
- Frequências históricas mantêm os turnos antigos para preservar os dados;
  novas turmas e sessões são integrais.
- O PIN identifica o perfil operacional, mas ainda não registra o nome da
  pessoa que executou cada baixa.
- Redis continua recomendado para sessões compartilhadas em produção; sem
  `REDIS_URL`, o cache utiliza a tabela do banco.

## Referências

- `documentation.md`, seção 5.3: contratos detalhados.
- `docs/CORRECAO_FASE_2_REFEICOES.md`: decisão sobre período e refeições.
- `docs/PLANO_SUBAPPS_3_FASES.md`: escopo e critérios das três fases.
