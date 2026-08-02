# Resultado da Fase 3 — revisão dos sub-apps

Data: 2 de agosto de 2026.

## Melhorias aplicadas

- O login por PIN compartilhado anuncia progresso, avisos e erros para leitores
  de tela, informa o estado ocupado e impede apagar um PIN vazio.
- Falhas de conexão agora recebem a mesma mensagem clara nos dois apps.
- O App Alunos informa quando a sessão foi encerrada por inatividade.
- Os controles possuem foco visível compartilhado e respeitam a preferência de
  redução de movimento do dispositivo.
- A Cozinha agrupa semanticamente as três refeições, anuncia carregamento e
  alertas, descreve o modal e devolve o foco ao botão que o abriu.
- O modal de confirmação não pode ser fechado pelo fundo durante uma baixa.
- Os botões receberam tipo explícito para evitar submissões acidentais.
- Foram adicionados projetos de teste em viewport de tablet, 768 × 1024.

## Documentação e operação

- `documentation.md` foi alinhado ao período integral, limite de 45 alunos,
  refeições, idempotência, serializers, migrations e variáveis de ambiente.
- `docs/OPERACAO_SUBAPPS.md` documenta endpoints, respostas 400/401/403/404/
  409/429, sessão, inatividade, smoke tests e riscos restantes.
- Os `.env.example` agora listam somente as variáveis usadas e explicam o
  padrão de cinco minutos de inatividade.
- As dependências instaladas estão alinhadas entre os dois apps; nenhuma troca
  de stack ou dependência adicional foi necessária.

## Validação concluída

- Backend operacional: 58 testes aprovados em dois blocos (27 + 31).
- App Alunos: 20 testes unitários aprovados.
- App Cozinha: 23 testes unitários aprovados.
- Navegador desktop: 6 fluxos completos aprovados.
- Navegador tablet 768 × 1024: 6 fluxos completos aprovados.
- Builds de produção aprovados:
  - App Alunos: JavaScript 245,79 kB; gzip 78,92 kB.
  - App Cozinha: JavaScript 252,23 kB; gzip 81,32 kB.
- `python manage.py check`: sem problemas.
- `makemigrations --check --dry-run`: nenhuma alteração pendente.
- Migration `0020_integral_turmas_and_refeicoes`: aplicada no ambiente local.
- Bundles verificados sem PINs de teste ou variáveis legadas de PIN.
- `git diff --check`: aprovado.

## Riscos mantidos fora desta fase

- O fator de consumo ainda é igual para as três refeições.
- A baixa continua parcial por item, conforme a regra atual.
- O PIN identifica o perfil, mas não individualiza o operador da cozinha.
- Frequências históricas preservam os turnos antigos.

Esses pontos exigem decisão de negócio e não foram transformados em novas
funcionalidades durante a revisão simples.
