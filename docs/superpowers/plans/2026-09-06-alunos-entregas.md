# Plano de implementação — alunos e entregas

Objetivo: executar o desenho aprovado em ../specs/2026-09-06-alunos-entregas.md.
Arquitetura: app Django distribuicao, reutilizando Escola, Turma, PIN e o serviço
transacional de estoque; páginas React no dashboard e no app de protagonistas.

- [x] Cadastro/importação: modelos, prévia validada XLSX/CSV, confirmação atômica
  e manutenção de alunos; testes de erros de linha, repetição e isolamento.
- [x] Rodadas: itens de estoque, liberação com destinatários fixados, transições
  protegidas e confirmação idempotente com baixa; testes de permissões e rollback.
- [x] Relatórios: totais, filtros, exportação CSV e impressão, preservando histórico.
- [x] Interface: cadastro/planilha, gestão de rodadas, relatórios e entregas por PIN.
- [ ] Verificação: Django, migrações, testes React, builds e navegador responsivo.

Sem implantação remota nesta etapa. Trabalho isolado em new/alunos-entregas.
