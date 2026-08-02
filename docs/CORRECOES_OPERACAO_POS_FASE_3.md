# Correções operacionais após a Fase 3

## Objetivo

Corrigir três pontos observados durante a validação local dos aplicativos:

1. impedir que operadores acessem a administração de módulos e usuários;
2. mostrar quais turmas compõem a contagem diária de alunos;
3. melhorar a leitura das refeições, produtos e quantidades no App Cozinha.

## Permissões administrativas

- O papel `ADMIN` do perfil da plataforma é a única autorização para acessar
  as telas e APIs de módulos e usuários.
- Um operador não recebe esse acesso mesmo que o usuário esteja marcado como
  `is_staff` no cadastro interno do Django.
- As opções `Módulos` e `Usuários` ficam ocultas no menu do operador.
- O acesso direto pelas URLs administrativas redireciona o operador para o
  inventário.
- O cabeçalho mostra o nome e o papel reais da sessão, sem identificar um
  operador como administrador.
- A permissão de manutenção dos cadastros de estoque continua independente,
  preservando o funcionamento já existente para operadores autorizados.

## Histórico diário de presença

O resumo diário da operação agora retorna a lista `turmas`, formada por:

- `turma`: nome da turma;
- `quantidade_alunos`: total registrado pela turma naquela data.

O quadro `Merenda hoje` apresenta esses registros abaixo do total geral. Quando
não houver presença registrada, mostra uma mensagem de estado vazio.

Como todas as turmas operam em período integral, a tela de contagem não exibe
mais os filtros `Manhã`, `Tarde` e `Integral`. As opções `Total` e turmas são
mostradas diretamente, e todo novo registro envia `INTEGRAL` automaticamente
para o servidor.

## Legibilidade no App Cozinha

- As refeições não selecionadas usam texto verde-escuro sobre fundo claro.
- A refeição selecionada mantém fundo verde com texto branco.
- Nome do produto, categoria, quantidade e alerta de estoque receberam cores,
  pesos e tamanhos explícitos.
- Em telas estreitas, a quantidade passa para uma nova linha para evitar
  sobreposição e cortes.

## Validações realizadas

- bloqueio visual e por URL para operador;
- bloqueio das APIs administrativas para operador;
- liberação das mesmas áreas para o papel `ADMIN`;
- resumo diário com múltiplas turmas e estado vazio;
- contraste das três refeições e dos itens da cozinha;
- testes unitários, integração, interface ponta a ponta e builds de produção.
