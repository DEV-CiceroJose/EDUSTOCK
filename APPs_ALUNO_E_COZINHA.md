# Apps Aluno e Cozinha — instalação pelo navegador

## Objetivo

Os aplicativos **EduStock Alunos** e **EduStock Cozinha** foram transformados
em Progressive Web Apps (PWAs). Com isso, continuam funcionando como sites e
também podem ser instalados diretamente pelo navegador, sem precisar publicar
um aplicativo nas lojas Google Play ou App Store.

Depois de instalados, cada app aparece com nome e ícone próprios na tela inicial
do celular ou no menu de aplicativos do computador e abre em uma janela
independente, sem a barra de navegação comum do navegador.

## O que foi implementado

### 1. Manifesto de cada aplicativo

Foram criados os arquivos:

- `app-alunos/public/manifest.webmanifest`
- `app-cozinha/public/manifest.webmanifest`

O manifesto informa ao navegador:

- nome completo e nome curto do aplicativo;
- descrição e idioma;
- rota inicial (`/login`);
- escopo de navegação (`/`);
- execução no modo `standalone`;
- orientação preferencial em modo retrato;
- cores de abertura e da barra do sistema;
- categorias do aplicativo;
- ícones de 192 × 192 e 512 × 512 pixels.

Como Alunos e Cozinha são publicados em domínios diferentes na Render, cada um
é reconhecido pelo navegador como um aplicativo independente.

### 2. Ícones próprios

Cada app recebeu uma identidade visual própria:

- **Alunos:** capelo escolar;
- **Cozinha:** chapéu de cozinheiro.

Os arquivos ficam em `public/icons/` dentro de cada projeto e incluem:

- `icon.svg`: versão vetorial original;
- `icon-192.png`: ícone usado pelos navegadores;
- `icon-512.png`: ícone de alta resolução e máscara adaptável;
- `apple-touch-icon.png`: ícone específico para iPhone e iPad.

O fundo dos ícones ocupa toda a imagem para funcionar corretamente com os
formatos de máscara aplicados por Android, ChromeOS e outros sistemas.

### 3. Integração com o HTML

Os arquivos `index.html` dos dois apps agora possuem:

- referência ao manifesto;
- favicon do aplicativo;
- ícone para dispositivos Apple;
- nome do aplicativo para instalação;
- cor do tema;
- metadados para execução em modo aplicativo no iOS e em outros navegadores.

### 4. Service workers

Foram criados:

- `app-alunos/public/service-worker.js`
- `app-cozinha/public/service-worker.js`

O service worker é registrado automaticamente pelo `src/main.jsx` de cada app
após o carregamento do build de produção. O modo de desenvolvimento não ativa
cache para evitar que arquivos antigos interfiram nos testes locais. Ele é o
componente que permite ao navegador tratar o site como uma PWA e manter os
arquivos essenciais da interface em cache.

Durante a instalação, ele armazena:

- a página inicial;
- o `index.html`;
- o manifesto;
- os arquivos JavaScript e CSS gerados com hash pelo Vite.

Os nomes dos arquivos gerados pelo Vite mudam a cada build. Por isso, o service
worker lê o `index.html` publicado, identifica automaticamente os caminhos em
`/assets/` e adiciona os arquivos correspondentes ao cache.

### 5. Estratégia de cache

O comportamento adotado é:

- **Navegação entre páginas:** tenta buscar a versão atual na rede; se não
  houver conexão, utiliza o `index.html` armazenado.
- **JavaScript, CSS, ícones e demais arquivos locais:** utiliza o cache quando
  o arquivo já estiver armazenado e busca na rede quando necessário.
- **Requisições da API em `/api/`:** nunca são interceptadas nem armazenadas
  pelo service worker.
- **Arquivos externos, como Google Fonts:** não são armazenados pelo service
  worker; sem internet, o navegador utiliza a fonte alternativa do sistema.

Essa separação é importante para impedir que autenticação, frequência, estoque
ou produção sejam exibidos ou enviados como se fossem dados atuais quando o
dispositivo estiver sem conexão.

## Como a instalação funciona

### Chrome e Edge no computador

1. Acessar a URL do app Alunos ou Cozinha.
2. Aguardar o primeiro carregamento completo.
3. Selecionar o ícone de instalação na barra de endereço ou abrir o menu do
   navegador e escolher **Instalar app**.
4. Confirmar a instalação.

### Android

1. Abrir o app pelo Chrome ou outro navegador compatível.
2. Abrir o menu do navegador.
3. Escolher **Instalar app** ou **Adicionar à tela inicial**.
4. Confirmar.

Dependendo da versão do navegador, uma sugestão automática de instalação também
pode ser exibida.

### iPhone e iPad

1. Abrir o endereço pelo Safari.
2. Tocar em **Compartilhar**.
3. Escolher **Adicionar à Tela de Início**.
4. Confirmar o nome e tocar em **Adicionar**.

O iOS normalmente não exibe o mesmo aviso automático de instalação encontrado
no Chrome.

## O que funciona sem internet

Após pelo menos um carregamento completo com conexão, a estrutura visual do app
pode ser aberta sem internet. Isso inclui o HTML, o JavaScript, o CSS e os ícones
armazenados.

As funções operacionais continuam dependendo do backend. Portanto, sem conexão
não é possível:

- autenticar com PIN;
- consultar o plano de produção;
- registrar a produção da cozinha;
- consultar ou registrar frequência de alunos;
- sincronizar alterações com o EduStock.

O cache atual evita uma tela totalmente indisponível, mas não implementa coleta
offline nem sincronização posterior de dados.

## Compatibilidade com o deploy atual

Não foi necessário alterar o `render.yaml`. Os dois serviços já são publicados
como sites estáticos independentes:

- `edustock-alunos` publica `app-alunos/dist`;
- `edustock-cozinha` publica `app-cozinha/dist`.

O Vite copia automaticamente os manifestos, service workers e ícones da pasta
`public/` para `dist/`. As regras de rewrite existentes na Render continuam
direcionando rotas como `/login`, `/registrar` e `/producao` para o React.

Para que um navegador permita a instalação em produção, o app deve ser servido
por **HTTPS**. As URLs da Render já utilizam HTTPS. Em desenvolvimento,
`localhost` também é aceito pelos navegadores.

## Validações realizadas

Foram executadas as seguintes verificações:

- validação de sintaxe dos dois service workers;
- validação do JSON dos dois manifestos;
- conferência das dimensões dos ícones;
- conferência de que manifestos, ícones, service workers, CSS e JavaScript foram
  copiados para os dois diretórios `dist`;
- build de produção dos dois aplicativos;
- suíte de testes do app Alunos: **23 testes aprovados**;
- suíte de testes do app Cozinha: **26 testes aprovados**.

## O que ainda falta

### Necessário para disponibilizar aos usuários

1. Fazer commit e enviar estas alterações ao repositório usado pela Render.
2. Executar ou aguardar um novo deploy dos serviços `edustock-alunos` e
   `edustock-cozinha`.
3. Abrir cada endereço publicado e confirmar no DevTools do navegador que o
   manifesto e o service worker foram reconhecidos.
4. Fazer um teste real de instalação em pelo menos um Android/Chrome e um
   iPhone/Safari, pois a apresentação do comando de instalação varia conforme o
   sistema operacional e a versão do navegador.
5. Validar o login e uma operação completa de cada app depois da instalação.

### Melhorias opcionais

- Adicionar um botão **Instalar aplicativo** dentro da tela de login. Hoje a
  instalação é oferecida pelo menu ou pela interface nativa do navegador.
- Adicionar uma explicação visual específica para instalação no iPhone, onde o
  evento automático de instalação não está disponível como no Chrome.
- Adicionar screenshots aos manifestos para enriquecer a caixa de instalação em
  navegadores que suportam esse recurso.
- Criar uma tela offline amigável informando que registros e autenticação
  exigem conexão.
- Implementar, somente se houver requisito operacional, uma fila offline com
  sincronização posterior. Isso exige regras para conflitos, expiração da
  sessão, segurança dos dados e prevenção de registros duplicados.
- Automatizar uma auditoria PWA em CI com navegador real, além dos testes e
  builds já executados.

As melhorias opcionais não impedem a instalação. A etapa indispensável que
resta é publicar o novo build e validar o comportamento nos dispositivos que
serão usados pela escola.
