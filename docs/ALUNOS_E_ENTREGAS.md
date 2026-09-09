# Alunos e entregas de materiais

## Gestão

No painel, abra **Alunos e entregas**. O acesso é reservado aos gestores da
escola ou da rede, com acesso ao módulo de inventário da escola selecionada.

1. Cadastre previamente as turmas no cadastro administrativo de turmas existente.
   O nome da planilha deve corresponder a uma turma ativa da mesma escola.
2. Baixe o modelo Excel. Preencha `nome`, `turma`, `série` e `sexo` (F, M ou N).
   Também é aceito CSV UTF-8 separado por vírgula ou ponto e vírgula.
3. Envie a planilha e confira a prévia. Erros bloqueiam a confirmação inteira.
   Cadastros idênticos existentes são ignorados com aviso; nomes ambíguos exigem
   revisão. Cadastre homônimos individualmente e use seus IDs para distingui-los.
4. Confirme em até 15 minutos. Os IDs são gerados pelo sistema. O cadastro pode
   ser editado ou inativado; nenhum arquivo de importação apaga alunos existentes.
5. Na aba **Rodadas de entrega**, escolha o tipo, dê um título e selecione os
   produtos e as quantidades por aluno nas unidades do estoque. Para um kit
   composto, adicione cada componente; para kit já embalado, selecione o produto
   correspondente à unidade completa. Fardamento nesta versão usa a mesma
   composição por aluno na rodada; não há seleção individual de tamanhos.
6. Confira e libere a rodada. Absorventes selecionam alunos cadastrados com sexo F;
   kit e fardamento selecionam todos os alunos ativos de turmas ativas.
7. Suspenda para interromper novas entregas, retome para continuar ou encerre
   definitivamente. Uma rodada encerrada mantém seu histórico.

O sistema fixa os destinatários na primeira liberação. Novos alunos ou alterações
de turma/sexo não modificam essa lista histórica: entram nas próximas rodadas.
Rodadas não reservam saldo antecipadamente; a disponibilidade é validada em cada
entrega. Todos os itens precisam ter saldo e lotes disponíveis.

Baixas de entregas não aceitam estorno avulso na tela de estoque. Nesta versão
não há cancelamento de recebimento confirmado: confira o aluno antes de confirmar.

## Protagonistas

Entre com o PIN atual e abra **Entregas**. Só aparecem rodadas liberadas e alunos
da turma autenticada. Busque o nome, confira ID e materiais, faça a entrega física
e confirme. O sistema registra horário e identificação do PIN/turma e baixa os
itens juntos. Cliques repetidos ou reenvio da mesma confirmação não duplicam baixa.

A autoria identifica o PIN da turma, não comprova uma identidade individual.
O registro exige conexão. Em falha de rede, atualize a lista para verificar se o
servidor recebeu a confirmação. Não há fila offline de entregas nem armazenamento
persistente da lista nominal no aplicativo.

## Relatórios

Na aba **Relatório**, filtre por rodada, material, turma e situação. O resumo
mostra total previsto, entregues, pendentes e percentual concluído. A lista mostra
nome e ID, turma, série, rodada, data e responsável pelo registro.

**Exportar CSV** usa os mesmos filtros e acrescenta a composição de materiais.
O CSV é compatível com Excel e neutraliza conteúdo interpretável como fórmula.
**Imprimir / Salvar PDF** usa a janela de impressão do navegador.

Os totais contam entregas previstas por aluno e rodada, não pessoas únicas em
todas as rodadas. Um aluno elegível para três rodadas representa três entregas.
Cadastros e listas individuais são restritos à escola e não podem ser consultados
pela cozinha. Respostas desses endpoints não devem ser armazenadas em cache.

## Publicação

Instalar as dependências de `requirements.txt`, aplicar as migrações de
`distribuicao` e gerar os builds do dashboard e app-alunos. Validar com dados
descartáveis na homologação antes de importar a planilha real da escola.
O login dos protagonistas continua dependendo do módulo de merenda habilitado;
as entregas também exigem inventário habilitado. A infraestrutura VPS é uma etapa
separada desta implementação.
