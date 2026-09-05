# Handoff da integração `edustock-vps` → `main`

Data: 5 de setembro de 2026  
Responsável: DEV-CiceroJose  
Base da integração: `origin/main` em `4869f0e`  
Origem integrada: `origin/edustock-vps` em `c3a8e57`  
Commit de merge: `0975406`

## Resultado

A preparação de VPS e a estrutura multiescola foram integradas à base mais
recente da `main`. O resultado preserva as proteções de segurança, estoque,
unidades de consumo, estornos, demonstração Render e interfaces que já estavam
na `main`, acrescentando município, escolas, vínculos, troca de escopo,
indicadores de rede, catálogo e cardápio municipais, contagem de estoque e a
documentação para o piloto Centelha.

O código está em condição de seguir para um piloto controlado. Isso ainda não
significa que uma escola possa depender dele em produção sem preparar e validar
a infraestrutura, os dados, a operação e a governança descritos abaixo.

## Decisões tomadas na integração

- As migrações da estrutura multiescola foram reposicionadas depois do histórico
  atual da `main`: `plataforma/0007`, `core/0026` e `core/0027`.
- A configuração de produção mais rígida da `main` foi mantida, incluindo
  validação de segredos, PostgreSQL, hosts, HTTPS, proxy e CSP.
- CORS e CSRF continuam configuráveis por ambiente; as origens CORS também são
  incluídas nas origens confiáveis de CSRF para os fluxos dos três frontends.
- O bloqueio do último administrador foi preservado e passou a respeitar o
  município do token, impedindo alterações de usuários de outra rede.
- Cardápios municipais passaram a criar ingredientes no modelo atual de unidades
  de consumo. Conversões inequívocas são preenchidas para kg→g, L→ml e UN→UN;
  caixas e pacotes exigem cadastro explícito do conteúdo.
- A gestão de usuários usa o tratamento central de sessão expirada também ao
  ativar, desativar e revogar sessões.
- O CI preserva a verificação de segurança e o PostgreSQL e executa migrações
  explicitamente antes dos testes.
- Django e Django REST Framework foram atualizados para os patches de segurança
  6.0.8 e 3.17.2 após o auditor de dependências bloquear as versões anteriores.

## Evidências locais

- Django: 287 testes aprovados.
- Verificação do Django: sem problemas.
- Migrações: nenhuma mudança não registrada.
- Dashboard: 144 testes aprovados, lint, TypeScript e build aprovados.
- App Alunos: 50 testes e build aprovados.
- App Cozinha: 40 testes e build aprovados.
- Navegador: 18 cenários aprovados com um worker, cobrindo desktop/tablet,
  login, PIN, presença, baixa, reconciliação offline, sessão expirada,
  permissões e entrada com nota fiscal.

As primeiras execuções simultâneas de Vitest/Playwright tiveram timeouts por
contenção de processos no Windows. Os arquivos afetados e depois as suítes
completas passaram isoladamente; o resultado de referência é a execução serial
acima. A validação foi feita fora da pasta sincronizada do OneDrive.

## O que falta antes de uma escola usar em produção

### P0 — infraestrutura e recuperação

- Provisionar a VPS e um PostgreSQL gerenciado ou administrado com backup.
- Configurar DNS, HTTPS, firewall e processo supervisionado para o Django.
- Preencher os segredos e domínios de `deploy/vps.env.example` sem reutilizar
  credenciais de demonstração.
- Executar migrações, `collectstatic`, health check e teste de reinício.
- Criar backup inicial e comprovar uma restauração completa em ambiente separado.

### P0 — validação no ambiente real

- Confirmar o CI verde no commit publicado, incluindo PostgreSQL.
- Testar no navegador os três domínios reais, sem mock: login/logout, troca de
  escola, PIN, CORS/CSRF/CSP, sessão expirada e revogação.
- Testar presença → produção → baixa FEFO → indicadores municipais com dados
  descartáveis de pelo menos três escolas, provando o isolamento entre elas.
- Testar perda de rede, fila offline e sincronização idempotente em celulares e
  tablets semelhantes aos que serão usados na escola.
- Fazer ensaio de carga básico e revisar logs para garantir que PINs, tokens,
  senhas e URLs de banco não sejam registrados.

### P0 — dados e governança

- Definir controlador/operador de dados, perfis autorizados e responsável local.
- Documentar finalidade, retenção, descarte, atendimento ao titular e resposta a
  incidentes conforme a LGPD.
- Cadastrar usuários individualmente, aplicar menor privilégio e entregar PINs
  por canal seguro; não compartilhar contas administrativas.
- Conferir e importar o cadastro real de produtos, fornecedores, unidades,
  conteúdo por embalagem, estoque inicial, turmas e cardápios com validação da
  escola e da nutricionista responsável.

### P1 — piloto assistido e operação

- Escolher uma única escola e executar um piloto assistido de 2 a 4 semanas.
- Treinar gestão, estoque, cozinha e representantes de turma, com procedimento
  em papel para indisponibilidade temporária.
- Definir canal e horário de suporte, responsável por incidentes e janela de
  manutenção.
- Acompanhar divergência de estoque, perdas, sincronizações pendentes, tempo de
  atendimento e adesão; registrar os resultados no relatório de piloto.
- Só ampliar para outras escolas depois de corrigir os problemas do piloto e
  aprovar formalmente segurança, restauração, operação e governança.

## Ordem recomendada da próxima etapa

1. Aguardar e revisar o CI do commit publicado na `main`.
2. Preparar VPS, PostgreSQL, domínios, HTTPS, segredos e backup.
3. Publicar primeiro em homologação e executar todos os testes P0 com dados
   descartáveis.
4. Obter a aprovação da escola, da nutricionista e do responsável por dados.
5. Executar o piloto assistido em uma escola.
6. Revisar as métricas e decidir entre corrigir, prolongar ou expandir o piloto.

## Limites deste handoff

Esta integração não altera nenhum recurso remoto da Hostinger, não configura
domínios, não aplica migrações em banco de produção e não comprova um fluxo
autenticado nos domínios finais. A mesclagem no Git encerra a integração de
código; implantação e aceite escolar continuam sendo uma etapa separada.
