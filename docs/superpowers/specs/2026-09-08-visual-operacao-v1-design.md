# EduStock — Visual e Operação em Movimento (Fase 1)

Data: 8 de setembro de 2026
Responsável: DEV-CiceroJose
Status: documento aprovado em 8 de setembro de 2026

## 1. Objetivo

Elevar o EduStock ao nível de apresentação e experiência esperado de um produto
comercial, sem diluir sua especialização em alimentação escolar. Ao acessar o
sistema, o gestor deve compreender em poucos segundos:

1. o que aconteceu hoje;
2. o que exige atenção;
3. qual é a próxima ação operacional.

A identidade adotada é **Operação em movimento**: base clara e acolhedora,
verde profundo para confiança e gestão, e laranja para movimento, prioridade e
alimentação. A comunicação pública deve destacar o ciclo real do produto:

`presença → planejamento → produção → consumo → estoque FEFO → indicadores`

## 2. Escopo da Fase 1

- Renovar a landing page pública.
- Criar o dashboard operacional autenticado em `/app`.
- Criar uma API agregada e somente leitura para o dashboard.
- Reorganizar a navegação em Visão geral, Operação e Gestão.
- Aplicar a identidade aprovada ao shell autenticado e aos componentes base.
- Preservar os fluxos atuais de inventário, movimentações, alertas, fornecedores,
  relatórios, merenda, rede municipal e administração.
- Validar a experiência em desktop, tablet e celular.

## 3. Fora do escopo

- Biblioteca, empréstimos e reservas de laboratórios.
- Leitura de código de barras e captura de fotos.
- Nova central de notificações e notificações push.
- Autenticação em dois fatores.
- Alterações no modelo de dados ou novas migrations.
- Divulgação de economia, redução de perdas ou impacto sem dados de piloto.
- Redesenho completo e simultâneo de cada fluxo interno existente.

Esses itens permanecem candidatos das fases seguintes. A Fase 1 deve consolidar
a fundação visual e a visão operacional antes de ampliar o produto.

## 4. Pessoas e escopos

### Gestor escolar

Vê apenas a escola ativa. Recebe o resumo do dia, alertas, saúde do estoque,
próximas ações e atividade recente permitida pelo seu perfil.

### Gestor de rede e nutricionista

Vê a operação da escola ativa e, quando autorizado, acesso ao painel municipal
com consolidação e comparação entre escolas.

### Operadores

Vê apenas os módulos liberados para sua escola e função. Indicadores financeiros
e dados de outras escolas não são expostos.

### Visitante

Vê a landing pública, a explicação do fluxo, os módulos existentes, as garantias
operacionais e as chamadas para acessar o sistema ou solicitar um piloto.

## 5. Landing page

### 5.1 Cabeçalho

- Marca EduStock.
- Âncoras: Como funciona, Recursos, Impacto e Segurança.
- Ações distintas: Acessar sistema e Solicitar piloto.
- No celular, preservar acesso e usar menu compacto para as âncoras.

### 5.2 Hero

- Kicker: Alimentação escolar conectada.
- Mensagem central: Da presença do aluno à decisão da Secretaria.
- Explicação curta sobre produção, consumo, FEFO e indicadores.
- Ações: Conhecer a operação e Ver demonstração.
- Selos factuais: Funciona offline, Estoque FEFO e Dados por escola.
- Prévia do dashboard com o rótulo **Exemplo demonstrativo**; números da
  ilustração nunca devem parecer resultados reais de uma escola.

### 5.3 Narrativa do produto

- Mostrar os quatro resultados: planejar, produzir, rastrear e decidir.
- Apresentar App Alunos, App Cozinha e Gestão da rede como interfaces de uma
  única operação.
- Explicar operação offline, isolamento entre escolas, permissões e auditoria.
- Não usar depoimentos, porcentagens ou economias sem fonte verificável.

### 5.4 Conversão

- Acesso ao sistema continua apontando para login ou painel quando autenticado.
- Solicitar piloto usa a URL configurada em `VITE_PILOT_CONTACT_URL`. Essa
  configuração é obrigatória em homologação e produção; se estiver ausente no
  desenvolvimento, o botão aparece desabilitado com uma explicação acessível.
  A landing não envia formulário nem coleta dados diretamente.
- A demonstração deve explicar que usa dados ilustrativos.

## 6. Dashboard operacional

### 6.1 Rota e navegação

- `/app` renderiza o novo dashboard; não redireciona mais ao inventário.
- Após login, o destino padrão passa a ser `/app`.
- A sidebar agrupa:
  - **Visão geral:** Operação do dia.
  - **Operação:** Merenda, Inventário, Movimentações e Alertas.
  - **Gestão:** Relatórios, Rede municipal e Fornecedores.
  - **Administração:** módulos e usuários, somente para quem já possui acesso.
- A geometria dos itens permanece estável em modo recolhido ou expandido.

### 6.2 Hierarquia da tela

1. Contexto: data, escola ativa, usuário e estado de sincronização.
2. Resumo: presença, refeições previstas, produção e pontos de atenção.
3. Fluxo do dia: presença, planejamento, produção e baixa FEFO.
4. Próximas ações: lista derivada de dados reais e links para os fluxos corretos.
5. Tendência: planejado, produzido e servido no período disponível.
6. Saúde do estoque: adequado, atenção e crítico.
7. Atividade recente: eventos permitidos da trilha de auditoria.

### 6.3 Variação por perfil

- Blocos dependentes de um módulo desabilitado não aparecem.
- Valores financeiros respeitam a permissão já usada nos relatórios.
- O painel municipal continua protegido pelo escopo de rede.
- Links de ação são renderizados somente quando o usuário pode executar o fluxo.

## 7. API agregada

### 7.1 Endpoint

`GET /api/dashboard/operacao/?data=YYYY-MM-DD`

- Autenticação administrativa existente por token.
- Data opcional; o padrão é a data local da aplicação.
- Escola obtida exclusivamente da sessão autenticada.
- Endpoint somente leitura.
- O cliente não envia nem substitui `escola_id`.

### 7.2 Contrato de resposta

```json
{
  "data": "2026-09-08",
  "escola": { "id": 1, "nome": "Escola Piloto" },
  "modulos": ["merenda", "inventario", "alertas"],
  "presenca": {
    "total_alunos": 0,
    "turmas_registradas": 0,
    "turmas_esperadas": 0,
    "media_historica": 0,
    "variacao_pct": null
  },
  "refeicoes": {
    "previstas": 0,
    "produzidas": 0,
    "servidas": 0,
    "descarte_kg": "0.000",
    "etapas": []
  },
  "estoque": {
    "itens": 0,
    "adequados": 0,
    "atencao": 0,
    "criticos": 0,
    "vencidos": 0,
    "proximos_vencimento": 0
  },
  "proximas_acoes": [],
  "tendencia": [],
  "atividade_recente": [],
  "atualizado_em": "2026-09-08T09:42:00-03:00"
}
```

Os grupos acima, seus significados e os tipos consumidos pelo frontend formam o
contrato da Fase 1.

Quando o usuário não possui o módulo necessário, a seção correspondente é
`null`: `presenca` e `refeicoes` exigem `merenda`; `estoque` exige `inventario`
ou `alertas`. A ausência por permissão não é serializada como zero e o frontend
não renderiza o bloco.

### 7.3 Cálculos

- Presença reutiliza a regra de `calcular_resumo_dia` e a quantidade de turmas
  ativas da escola.
- Refeições reutilizam registros de produção e refeição existentes.
- Estoque reutiliza a classificação de alertas e saldos atuais.
- Tendência usa os sete dias consecutivos encerrados na data solicitada, sempre
  com datas e valores reais.
- Próximas ações são regras determinísticas, não texto gerado:
  - turma ativa ainda sem presença na data;
  - refeição planejada aguardando produção ou baixa;
  - estoque crítico, vencido ou próximo do vencimento;
  - divergência de contagem física ainda relevante.
- Atividade recente traz no máximo os oito registros mais novos de
  `RegistroAuditoria`, filtrados por escola e pelas permissões do solicitante,
  sem incluir segredos ou conteúdo sensível.
- Ações, tendência e auditoria também são filtradas pelos módulos do usuário;
  esconder um card somente no frontend não é considerado proteção suficiente.

## 8. Componentes de frontend

- `DashboardOperacionalPage`: coordena a tela e seus estados.
- `useOperationalDashboard`: busca, cancela e atualiza o resumo.
- `OperationalSummaryCards`: indicadores do dia.
- `DailyFlow`: andamento de presença até baixa FEFO.
- `NextActions`: prioridades e links permitidos.
- `ProductionTrend`: tendência com alternativa textual acessível.
- `StockHealth`: distribuição e ligação para alertas.
- `RecentActivity`: trilha recente resumida.
- `DashboardSkeleton`, `DashboardEmptyState` e `DashboardSectionError`:
  carregamento, ausência de dados e falhas parciais.

Componentes devem permanecer pequenos, com contratos explícitos e sem conhecer
detalhes da camada HTTP.

## 9. Sistema visual

- Verde profundo: navegação, confiança e ações estruturais.
- Laranja: chamada principal, progresso atual e itens que pedem decisão.
- Creme: fundo público e áreas de contexto humano.
- Branco: superfícies de dados e formulários.
- Vermelho continua reservado a erro ou risco crítico.
- Títulos têm hierarquia forte e texto corrido prioriza legibilidade.
- Cards, botões, campos, etiquetas e estados de foco usam os tokens
  compartilhados, evitando valores divergentes por tela.
- Movimento é discreto e informativo; respeita `prefers-reduced-motion`.

## 10. Estados e falhas

### Carregamento

Manter a geometria da tela com skeletons. Não exibir zeros enquanto a resposta
ainda não chegou.

### Sem dados

Informar o registro ausente e oferecer o próximo passo permitido, como abrir a
contagem ou consultar o plano do dia. Ausência de dado não vira erro.

### Falha parcial

Quando possível, manter os blocos que carregaram. O bloco com falha explica o
problema em linguagem simples e oferece nova tentativa.

### Sessão expirada

Reutilizar o tratamento central de autenticação e levar ao login sem deixar a
tela em estado inconsistente.

### Falha completa

Apresentar uma tela recuperável com nova tentativa. Detalhes técnicos ficam nos
logs e não são expostos ao usuário.

## 11. Responsividade e acessibilidade

- Desktop: sidebar fixa e grade completa.
- Tablet: sidebar compacta, grade em duas colunas e ações preservadas.
- Celular: navegação em gaveta, cards em uma coluna e fluxo diário rolável ou
  empilhado sem perder a ordem semântica.
- Alvos de toque com tamanho confortável.
- Contraste compatível com WCAG AA.
- Navegação completa por teclado, foco visível e fechamento com Escape.
- Gráficos têm resumo textual; cor nunca é o único sinal de estado.
- Títulos, regiões, listas e botões usam semântica acessível.

## 12. Testes

### Backend

- Resumo vazio e resumo com dados do dia.
- Isolamento entre pelo menos três escolas.
- Perfis e campos financeiros.
- Módulos desabilitados.
- Datas válidas e inválidas.
- Regras de próximas ações.
- Auditoria filtrada e sem dados sensíveis.
- Consultas em quantidade controlada para evitar regressão de desempenho.

### Frontend

- Rota `/app` e destino após login.
- Landing e chamadas principais.
- Renderização do dashboard com dados completos.
- Loading, vazio, falha parcial, falha completa e nova tentativa.
- Visibilidade por módulo e perfil.
- Links das próximas ações.
- Sidebar desktop e móvel sem mudança de geometria.
- Alternativas textuais dos gráficos.

### Navegador

- Login → dashboard → merenda → inventário → dashboard.
- Desktop, tablet e celular.
- Navegação por teclado nos elementos principais.
- Sessão expirada e resposta proibida.
- Evidência visual comparada aos mockups aprovados.
- Regressão dos fluxos existentes dos três frontends.

## 13. Critérios de aceite

- `/app` apresenta dados reais da escola ativa.
- O usuário identifica resumo, atenção e próxima ação sem navegar para outra
  tela.
- Nenhum número demonstrativo aparece dentro do painel autenticado.
- A landing identifica claramente qualquer dado ilustrativo.
- Isolamento entre escolas e permissões possuem testes automatizados.
- Navegação não muda de posição ao recolher ou expandir a sidebar.
- Landing e dashboard funcionam em desktop, tablet e celular.
- Estados vazios e de falha oferecem uma saída compreensível.
- Testes existentes continuam aprovados.
- Lint, verificação de tipos e builds dos três frontends passam.
- Verificações Django, migrations e suíte backend passam em ambiente adequado.

## 14. Entrega e continuidade

A implementação será feita incrementalmente:

1. contrato e testes da API agregada;
2. rota e dashboard com estados completos;
3. shell autenticado e navegação;
4. landing aprovada;
5. consolidação dos tokens visuais;
6. validação unitária, integrada, responsiva e visual.

Após a Fase 1, o próximo ciclo deve avaliar código de barras, contagem móvel,
fotos, notificações e autenticação em dois fatores com base no uso do piloto.
