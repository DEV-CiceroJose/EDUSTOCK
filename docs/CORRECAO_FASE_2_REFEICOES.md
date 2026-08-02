# Correção complementar da Fase 2 — período integral e refeições

Data: 1 de agosto de 2026.

## Regra aplicada

- Todas as turmas são exclusivamente integrais.
- O App Alunos registra uma presença por turma e por dia, sempre no período
  integral.
- A mesma frequência integral é usada no cálculo das três refeições.
- A cozinha pode registrar exatamente uma baixa para cada refeição do dia:
  café da manhã, almoço e lanche da tarde.
- Uma quarta baixa só é possível se pertencer a outro dia. Repetir uma refeição
  já processada no mesmo dia não altera o estoque.

## Alterações técnicas

- `Turma.TURNO_CHOICES` passou a oferecer somente `INTEGRAL`.
- A migration `0020_integral_turmas_and_refeicoes` normaliza turmas existentes.
- `OperacaoBaixaProducao.turno` foi renomeado para `refeicao`.
- Foi adicionada uma restrição única para `data + refeicao`.
- O plano da cozinha consulta sempre a frequência integral e informa se a
  refeição selecionada já teve baixa.
- Os contratos do plano e da baixa agora recebem `refeicao` no lugar de
  `turno`.
- O App Cozinha possui três seletores responsivos com os nomes completos das
  refeições.
- O botão principal fica bloqueado e informa `Baixa já realizada` depois do
  processamento daquela refeição.
- O App Alunos mostra `Período integral` e rejeita sessões de turma com outro
  período.

## Compatibilidade

Os registros históricos de frequência continuam preservando o turno gravado.
A nova regra é aplicada às turmas e aos novos registros. As operações de baixa
criadas pelo modelo anterior são convertidas para refeições pela migration.

## Cobertura

- Uma operação por cada uma das três refeições é aceita.
- Uma segunda operação para a mesma refeição/data retorna HTTP 409.
- Reutilizar um UUID em outra refeição retorna HTTP 409.
- O estoque permanece não negativo após as três operações.
- Os três seletores aparecem no App Cozinha e os antigos turnos não aparecem.
- Uma refeição já processada bloqueia uma nova confirmação na interface.
