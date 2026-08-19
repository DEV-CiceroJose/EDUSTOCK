# EduStock — preparação para o próximo Centelha

## Tese de inovação

> EduStock é a camada operacional da alimentação escolar que transforma a presença real do dia em previsão de produção, consumo rastreável e baixa automática de estoque, funcionando mesmo em escolas com conexão instável e consolidando os resultados para a Secretaria de Educação.

O produto não deve ser apresentado como ERP escolar. O ciclo demonstrável é:

`presença → produção → consumo → estoque FEFO → indicadores municipais`

## O que já está implementado

- Município/Secretaria → escolas → vínculos de usuários, com papéis de gestor da rede, gestor escolar, nutricionista e operador.
- Escopo da escola gravado no token e derivado da autenticação. Identificadores arbitrários enviados pelo cliente não alteram o escopo operacional.
- Migração automática da instalação anterior para “Município Piloto / Escola Piloto”, preservando os registros e totais existentes.
- Estoque, lotes, frequência, cardápios, produção, PINs, auditoria e configurações associados à escola.
- PIN por escola e sessões operacionais com escola; filas offline mantêm a origem da operação.
- Painel municipal consolidado e por escola, com rastreio até os registros de refeição.
- Indicadores de planejado, produzido, servido, sobra, descarte, custo/refeição e atendimento do cardápio.
- Catálogo municipal de produtos, modelos centrais de cardápio e importação CSV inicial.
- Economia estimada deliberadamente vazia até existir baseline auditada.

## Interfaces principais

| Recurso | Rota |
|---|---|
| Municípios, escolas e vínculos | `/api/municipios/`, `/api/escolas/`, `/api/vinculos/` |
| Troca segura do escopo operacional | `/api/auth/escola/` |
| Indicadores consolidados | `/api/rede/indicadores/` |
| Importação de produtos | `/api/rede/importar-produtos/` |
| Catálogo municipal | `/api/rede/catalogo-produtos/` |
| Modelos municipais de cardápio | `/api/rede/cardapios-modelo/` |
| Evidências de refeição | `/api/registros-refeicao/` |
| Conferências e divergências de estoque | `/api/contagens-estoque/` |

CSV aceito (vírgula ou ponto e vírgula; UTF-8):

```csv
nome;categoria;grupo;unidade;estoque_minimo;perecivel
Arroz;Merenda;Grãos;KG;20;nao
Leite;Merenda;Laticínios;L;15;sim
```

## Trabalho de campo que não pode ser substituído por software

| Entrega | Evidência de conclusão |
|---|---|
| Especialista em nutrição/PNAE | Nome, função, dedicação, entregas e termo de participação |
| Piloto em três escolas | 8–12 semanas de dados, relatório por escola e consolidação da Secretaria |
| Validação do problema | Dez entrevistas registradas com funções e padrões de resposta |
| Interesse institucional | Três cartas assinadas, sem promessa de contratação |
| Modelo B2G | Faixas de preço testadas e registro das reações dos compradores |
| Propriedade intelectual e dados | Titularidade, contratos, inventário de dados e plano de registro de marca/software |
| Revisão externa | Duas avaliações independentes e média mínima de 4,7 |

Use os modelos desta pasta. Não registre como resultado uma meta, intenção verbal ou dado sem fonte.

## Referências para revalidação

- [Edital Centelha 3 Ceará](https://montenegro.funcap.ce.gov.br/sugba/edital/768.pdf)
- [Resultado da Fase 1 do Centelha 3 Ceará](https://programacentelha.com.br/wp-content/uploads/2026/02/CE-Lista-Final-Centelha-3-04-02-2026.pdf)
- [Resultados da terceira edição no Ceará](https://programacentelha.com.br/centelha-ceara-confira-os-principais-resultados-da-terceira-edicao-do-programa-no-estado/)
- [Ranggo](https://ranggo.org/)

Valores, elegibilidade, pesos e datas devem ser conferidos novamente quando o próximo edital for publicado.
