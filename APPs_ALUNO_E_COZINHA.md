# Apps Alunos e Cozinha

Os apps EduStock Alunos e EduStock Cozinha são Progressive Web Apps (PWAs).
Continuam funcionando como sites e podem ser instalados pelo navegador, sem
publicação em lojas.

## Publicação atual

O `render.yaml` declara dois sites estáticos independentes:

| App | Serviço | Origem | Publicação | Rota autenticada |
| --- | --- | --- | --- | --- |
| Alunos | `edustock-alunos` | `app-alunos/` | `app-alunos/dist` | `/registrar` |
| Cozinha | `edustock-cozinha` | `app-cozinha/` | `app-cozinha/dist` | `/producao` |

Os dois entram por `/login`, usam `VITE_API_BASE` para localizar
o domínio HTTPS da API na Hostinger e possuem rewrite de SPA para `/index.html`.
Não existe `.env.production` versionado; `VITE_API_BASE` é preenchida na Render
e validada antes de cada build.

## Autenticação

- Alunos usa um PIN criado para o perfil de acesso correspondente.
- Cozinha usa um PIN criado para o perfil de acesso correspondente.
- Os PINs devem ser distintos, secretos e compartilhados somente com quem fará
  a avaliação.
- As sessões expiram e voltam ao login após inatividade.
- Em demonstrações, nunca reutilize um PIN adotado por uma escola real.

O backend na VPS armazena os PINs protegidos, não em texto puro. Cadastre e
revogue acessos somente pela administração autorizada do sistema.

## Instalação

### Chrome ou Edge no computador

1. Abra a URL publicada do app.
2. Aguarde o carregamento completo.
3. Use o ícone da barra de endereço ou o menu **Instalar app**.
4. Confirme.

### Android

1. Abra o app em um navegador compatível.
2. Escolha **Instalar app** ou **Adicionar à tela inicial**.
3. Confirme.

### iPhone ou iPad

1. Abra o app no Safari.
2. Toque em **Compartilhar**.
3. Selecione **Adicionar à Tela de Início**.
4. Confirme.

HTTPS é obrigatório em produção. As publicações da Render usam HTTPS;
`localhost` também é aceito no desenvolvimento.

## Cache e funcionamento offline

O manifesto, os ícones e o service worker ficam em `public/` e são copiados
pelo Vite para o build. A navegação tenta a rede e pode usar o `index.html` em
cache. JavaScript, CSS e ícones locais também podem ser reutilizados do cache.

Requisições da API não são guardadas pelo service worker. A interface pode
abrir sem internet após um carregamento completo, mas autenticação e consultas
atuais continuam dependendo do backend.

Quando a rede falha durante um registro operacional:

- a ação pendente permanece em uma fila local visível;
- o usuário pode tentar novamente ou remover a pendência;
- erros de autenticação pausam o envio até novo login;
- frequência e produção usam identificadores idempotentes para evitar
  duplicidade no reenvio.

A fila offline fica no dispositivo do usuário e os registros confirmados ficam
no PostgreSQL da VPS. Dados locais continuam sujeitos à política de retenção e
ao controle de acesso do dispositivo.

## Validação após cada publicação

1. Abra `/login` nos dois sites e confirme identidade visual e teclado.
2. Entre com o PIN correto de cada app.
3. Em Alunos, valide uma contagem fictícia em `/registrar`.
4. Em Cozinha, valide plano e baixa fictícios em `/producao`.
5. Desative a rede antes de confirmar uma nova ação e confira a pendência.
6. Reative a rede, autentique novamente se necessário e sincronize.
7. Confirme que o backend registrou a ação uma única vez.
8. Atualize a página e confirme que manifesto e service worker não ficaram em
   uma versão antiga.
9. Faça ao menos um teste de instalação em Android/Chrome e iPhone/Safari antes
   de uma implantação em escola.

O checklist completo está em
[docs/CHECKLIST_GO_LIVE_DEMO.md](docs/CHECKLIST_GO_LIVE_DEMO.md).

## Melhorias futuras

- adicionar screenshots aos manifestos;
- medir o volume e a idade das operações offline;
- definir política de expiração para pendências antigas;
- automatizar uma auditoria PWA com navegador real no CI.
