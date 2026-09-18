# Acordo de publicação — Hostinger, Render e domínio institucional

Data de consolidação: 18 de setembro de 2026.

Este documento registra as decisões tomadas para a publicação do EduStock e
separa claramente o que foi acordado, o que já está preparado e o que ainda
depende de execução nos provedores.

## Objetivo

Publicar o EduStock sem retirar do ar nem substituir o site que já utiliza o
domínio `semanadetecnologiaetejbl.tech`.

A solução continuará dividida em duas plataformas:

- backend Django e banco PostgreSQL em uma VPS da Hostinger;
- dashboard e aplicativos web de Alunos e Cozinha como sites estáticos na
  Render.

## Endereços acordados

O endereço `semanadetecnologiaetejbl.tech/edustock` é um caminho dentro do
domínio principal, e não um subdomínio. Um caminho não pode ser direcionado por
DNS para outro servidor. Para manter o site principal intacto, a publicação
deve utilizar subdomínios verdadeiros:

| Componente | Endereço público | Plataforma |
| --- | --- | --- |
| Dashboard | `https://edustock.semanadetecnologiaetejbl.tech` | Render |
| Aplicativo Alunos | `https://alunos.edustock.semanadetecnologiaetejbl.tech` | Render |
| Aplicativo Cozinha | `https://cozinha.edustock.semanadetecnologiaetejbl.tech` | Render |
| API | `https://api.edustock.semanadetecnologiaetejbl.tech` | VPS Hostinger |

Se for necessário divulgar também
`https://semanadetecnologiaetejbl.tech/edustock`, o servidor responsável pelo
site principal deverá redirecionar esse caminho para
`https://edustock.semanadetecnologiaetejbl.tech`. Esse redirecionamento é uma
etapa separada e não deve ser criado antes de confirmar a tecnologia e a
configuração do site existente.

O registro raiz de `semanadetecnologiaetejbl.tech` não será substituído pelo IP
da VPS do EduStock.

## Arquitetura de produção

### Hostinger

A VPS executará contêineres separados para:

- PostgreSQL, com volume persistente;
- API Django servida por Gunicorn;
- Caddy como único serviço exposto nas portas 80 e 443.

O Caddy será responsável pelo certificado HTTPS e encaminhará as requisições de
`api.edustock.semanadetecnologiaetejbl.tech` para a API. O banco não ficará
exposto publicamente.

### Render

A Render publicará três sites estáticos independentes:

- `edustock-dashboard`;
- `edustock-alunos`;
- `edustock-cozinha`.

Os builds receberão apenas a URL pública da API. Segredos do Django, senha do
banco e chaves operacionais não serão enviados à Render.

## DNS planejado

Após obter o IP público definitivo da VPS e os endereços gerados pela Render,
serão criados os registros abaixo no provedor DNS do domínio:

| Nome | Tipo | Destino |
| --- | --- | --- |
| `api.edustock` | A | IP público da VPS Hostinger |
| `edustock` | CNAME | endereço do dashboard na Render |
| `alunos.edustock` | CNAME | endereço do app Alunos na Render |
| `cozinha.edustock` | CNAME | endereço do app Cozinha na Render |

Os valores definitivos devem ser copiados dos painéis dos provedores; não devem
ser presumidos ou preenchidos com exemplos.

## Segurança e operação

- `SECRET_KEY`, `PIN_LOOKUP_SECRET` e a senha do PostgreSQL serão gerados como
  valores fortes e permanecerão somente no ambiente da VPS.
- `PIN_LOOKUP_SECRET` deverá ser preservado em toda atualização futura.
- O firewall permitirá somente os acessos estritamente necessários, com a API
  pública exposta por HTTPS.
- As origens CORS e CSRF serão limitadas aos três endereços públicos da Render.
- O modo de demonstração e o `DEBUG` permanecerão desativados em produção.
- O banco terá backup periódico, retenção definida e cópia externa à VPS.
- Atualizações não poderão remover o volume do PostgreSQL. Em especial, não se
  deve executar `docker compose down --volumes` no ambiente de produção.
- Credenciais de teste não serão versionadas. Contas e PINs de validação serão
  criados diretamente na instalação publicada.

## Sequência de publicação

1. Acessar a conta Hostinger que possui a nova VPS e confirmar IP, sistema
   operacional e estado do servidor.
2. Confirmar onde o DNS de `semanadetecnologiaetejbl.tech` é administrado.
3. Publicar PostgreSQL, API e proxy HTTPS na VPS usando o pacote `deploy/`.
4. Criar o registro `api.edustock` apontando para a VPS.
5. Validar `https://api.edustock.semanadetecnologiaetejbl.tech/api/health/`.
6. Publicar os três frontends na Render com a URL real da API.
7. Vincular os três subdomínios da Render e aguardar emissão dos certificados.
8. Validar em navegador os fluxos administrativos e operacionais.
9. Configurar backups e confirmar uma restauração de teste.
10. Avaliar o redirecionamento opcional de `/edustock` no site principal.

## Critérios de aceite

A publicação somente será considerada concluída quando:

- os quatro endereços públicos responderem com HTTPS válido;
- administrador e operador entrarem no dashboard sem perder a sessão;
- a área de produção da merenda funcionar para ambos os perfis autorizados;
- os aplicativos Alunos e Cozinha autenticarem por PIN e acessarem a API sem
  bloqueio de CORS;
- migrations estiverem aplicadas ao PostgreSQL de produção;
- health check, logs e reinício dos contêineres forem verificados;
- o site principal continuar funcionando sem regressão;
- um backup real puder ser restaurado em banco separado.

## Situação na data deste documento

### Concluído

- pacote de infraestrutura híbrida incorporado à branch principal pela PR 69;
- imagens e composição da VPS validadas em integração contínua;
- builds dos três frontends aprovados;
- testes de backend, PostgreSQL, segurança e navegador aprovados;
- teste local de login, produção da merenda e PINs concluído.

### Pendente

- autenticação na conta Hostinger que possui a nova VPS;
- confirmação do IP e preparação efetiva do servidor;
- alterações de DNS;
- criação e publicação dos três serviços EduStock na Render;
- emissão dos certificados públicos;
- criação das contas de validação no banco de produção;
- validação pública completa e restauração de backup.

Portanto, o sistema está preparado para o deploy, mas este documento não deve
ser interpretado como evidência de que a publicação externa já foi concluída.

