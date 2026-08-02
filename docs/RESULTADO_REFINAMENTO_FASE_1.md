# Resultado do refinamento — Fase 1

## Objetivo

Refinar a experiência dos aplicativos operacionais antes de ampliar as funções
integradas ao backend.

## Alterações entregues

- Marca padronizada como `EduStock Alunos` e `EduStock Cozinha` nos títulos,
  manifestos e metadados de instalação.
- Ícones da interface migrados de Lucide para Phosphor Icons.
- Ícones vetoriais dos manifestos redesenhados com os traçados oficiais de
  `GraduationCap` e `ChefHat` da família Phosphor.
- Indicador `Online` ou `Sem conexão` na tela de PIN.
- Teclado bloqueado quando o dispositivo estiver offline.
- Botão nativo de instalação exibido quando o navegador disponibilizar o
  evento de instalação.
- Instruções alternativas para Android, computador, iPhone e iPad.
- Aviso e ação para aplicar uma nova versão quando houver service worker em
  espera.
- Mensagem `Servidor iniciando, aguarde…` quando o login levar mais de 1,5
  segundo.
- Cache PWA ativado somente no build de produção, preservando o desenvolvimento
  local sem arquivos antigos.
- Layout de PIN limitado a 420 pixels em telas largas e mantido responsivo em
  celulares.

## Regras preservadas

- Nenhuma resposta de `/api/` é armazenada pelo service worker.
- Login, frequência e baixa de produção continuam exigindo conexão.
- PIN e token operacional continuam sendo validados pelo backend.
- O limite de 45 alunos e as três refeições diárias permanecem ativos.

## Validação

- App Alunos: 23 testes aprovados e build de produção concluído.
- App Cozinha: 26 testes aprovados e build de produção concluído.
- Manifestos e service workers disponíveis nos builds locais.
- Telas de login verificadas em largura móvel e desktop.
