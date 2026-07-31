# Implementação da Fase 4

## Landing page pública

- A rota `/` agora apresenta o EduStock sem exigir autenticação.
- Visitantes são direcionados a `/login`; usuários com sessão ativa recebem um
  atalho direto para `/inventario`.
- A página possui navegação por seções, apresentação dos principais recursos,
  fluxo de uso e chamada para acesso ao sistema.
- O layout foi validado em desktop e em viewport móvel de 375 × 812, sem
  rolagem horizontal e com as ações principais visíveis.
- As páginas autenticadas passaram a ser carregadas sob demanda. Assim, a
  landing não baixa todo o dashboard e as bibliotecas de PDF na primeira visita.

## TypeScript progressivo

A migração começou pelas fronteiras mais sensíveis do frontend:

- `src/api/http.ts`: cliente HTTP genérico e respostas paginadas;
- `src/api/index.ts`: contratos dos adaptadores real e mock;
- `src/api/types.ts`: tipos centrais de produto, fornecedor, alertas e
  movimentações;
- `src/api/units.ts`: unidades e periodicidades;
- `src/hooks/useDashboardData.ts` e `useAppConfig.ts`: estado e retornos
  tipados.

O projeto continua aceitando componentes JavaScript/JSX. Novos arquivos podem
ser migrados gradualmente e `npm run typecheck` valida a parte já tipada.

## Dependências

O Dependabot passou a acompanhar semanalmente as dependências Python e os três
aplicativos Node. O `npm audit` do frontend ainda informa duas ocorrências altas
provenientes do mesmo aviso do React Router para processamento de ações em modo
RSC. O EduStock usa `BrowserRouter` como SPA estática, sem servidor React, RSC,
actions ou loaders do modo de dados; portanto, o caminho descrito pelo aviso não
é utilizado pela aplicação. A versão atual foi mantida porque o downgrade
sugerido pelo catálogo reintroduz vulnerabilidades já corrigidas de
redirecionamento e XSS. O alerta deve ser removido assim que houver uma versão
atual sem essa faixa afetada.

## Testes de fluxos críticos

O Playwright cobre cinco jornadas no navegador:

1. landing pública e login do gestor;
2. cadastro de produto com saldo inicial;
3. entrada de estoque com nota fiscal;
4. login por PIN e registro de presença da turma;
5. landing em viewport móvel.

O job `Fluxos críticos E2E` foi incluído no GitHub Actions. Para executar
localmente:

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

## Alertas configuráveis

O model singleton `ConfiguracaoAlertas` guarda:

- quantidade de dias para classificação crítica de validade;
- antecedência padrão da consulta de validade;
- percentual do estoque mínimo que gera alerta de estoque baixo.

Os valores iniciais continuam sendo 7 dias, 30 dias e 20%. Um administrador
pode alterá-los em **Django Admin → Configuração de alertas**. A API devolve os
parâmetros efetivos no campo `configuracao` da resposta de alertas.

## Conversão dos campos legados

A migration `0018_alert_config_and_remove_legacy_product_fields` executa a
conversão antes de remover `Produto.numero_nota_fiscal` e `Produto.preco`:

1. notas antigas são associadas a entradas reais sem número quando não há
   ambiguidade;
2. produtos históricos sem entrada recebem uma `Entrada` e uma
   `Movimentacao` de conversão;
3. os campos duplicados são removidos somente depois da cópia;
4. relatórios passam a consultar exclusivamente entradas e movimentações.

O saldo de `Produto.quantidade` não é modificado durante a conversão. A API de
produtos expõe `ultimo_preco`, calculado a partir da movimentação de entrada mais
recente, para manter a estimativa financeira do inventário sem duplicar dados.

Antes do primeiro deploy desta migration, mantenha um backup recente do banco.
O processo é automatizado e testado, mas a remoção das colunas antigas não tem
reversão automática.

## Validação

```bash
python manage.py makemigrations --check --dry-run
python manage.py test

cd frontend
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```
