# Apps Alunos e Cozinha

Os apps EduStock Alunos e EduStock Cozinha são Progressive Web Apps (PWAs).
Continuam funcionando como sites e podem ser instalados pelo navegador, sem
publicação em lojas.

## Publicação atual

O `render.yaml` declara dois sites estáticos independentes:

| App | Serviço | Origem | Publicação | Rota autenticada |
| --- | --- | --- | --- | --- |
| Alunos | `edustock-demo-alunos` | `app-alunos/` | `app-alunos/dist` | `/registrar` |
| Cozinha | `edustock-demo-cozinha` | `app-cozinha/` | `app-cozinha/dist` | `/producao` |

Os dois entram por `/login`, usam `VITE_API_BASE` para localizar
`edustock-demo-api` e possuem rewrite de SPA para `/index.html`. Não existe
`.env.production` versionado; a URL da API é definida pelo Blueprint durante o
build.

## Autenticação

- Alunos usa o PIN fictício definido em `DEMO_ALUNOS_PIN`.
- Cozinha usa o PIN fictício definido em `DEMO_COZINHA_PIN`.
- Os PINs devem ser distintos, secretos e compartilhados somente com quem fará
  a avaliação.
- As sessões expiram e voltam ao login após inatividade.
- Na demonstração, nunca reutilize um PIN adotado por uma escola real.

O backend armazena os PINs protegidos, não em texto puro. Na demonstração, o
comando idempotente `python manage.py preparar_demo` cria ou atualiza os acessos
a partir das variáveis secretas da Render.

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

O filesystem do Web Service Free da Render é efêmero, mas a fila offline fica
no dispositivo do usuário e os registros confirmados ficam no PostgreSQL. Nem a
fila local nem o plano gratuito devem receber dados reais nesta demonstração.

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

O checklist completo da demonstração está em
[docs/CHECKLIST_GO_LIVE_DEMO.md](docs/CHECKLIST_GO_LIVE_DEMO.md).

## Melhorias futuras

- adicionar screenshots aos manifestos;
- medir o volume e a idade das operações offline;
- definir política de expiração para pendências antigas;
- automatizar uma auditoria PWA com navegador real no CI.
