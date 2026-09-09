# Cadastro de alunos e distribuição de materiais

Escopo aprovado: importar Excel/CSV, gerar IDs internos, distribuir absorventes
às meninas e kits/fardamento a todos, somente após liberação da gestão; registrar
baixa de estoque e emitir relatórios de entregues e pendentes exportáveis.

Um aluno pertence a uma escola e turma existente. A planilha contém nome, turma,
série e sexo, sem ID obrigatório. Prévia obrigatória; erros impedem todo o lote.
Registros já existentes não são sobrescritos; diferenças em nomes repetidos
exigem revisão. Cadastro manual admite homônimos; o ID distingue os registros.
Turmas não são inventadas a partir de nomes da planilha: usam o cadastro atual.

Uma rodada contém tipo, título e itens/quantidades em unidades de estoque.
Estados: rascunho, liberada, suspensa e encerrada. A primeira liberação fixa a
lista de destinatários e seus dados de identificação para preservar o histórico.
Novos alunos entram em rodadas posteriores. Somente a gestão da escola ou rede
pode importar, alterar alunos, liberar e consultar relatórios gerais.

O PIN permite consultar e entregar apenas à turma/escola autenticada. A autoria
identifica o PIN e a turma, não uma pessoa individual. A entrega é transacional,
única por rodada/aluno e usa o serviço de movimentações existente. Repetir uma
confirmação não baixa novamente. Suspensão e entrega usam o mesmo bloqueio da
rodada. Sem internet não se confirma nem se guarda lista nominal no dispositivo.

Relatório por escola com filtros de rodada, tipo, turma e situação; totais,
pendentes, entregues, nome, ID, série, turma, data e responsável. CSV protegido
contra fórmulas e impressão pelo navegador. A tela operacional não expõe sexo.

Validar migrações, permissões, importação atômica, concorrência/repetição, saldo
insuficiente com rollback, filtros/exportação e interfaces desktop/mobile.
