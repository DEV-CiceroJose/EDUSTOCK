# Deploy híbrido do EduStock

Este é o desenho oficial de publicação do projeto:

| Camada | Hospedagem | Exposição pública |
| --- | --- | --- |
| Dashboard React | Render Static Site | HTTPS |
| App Alunos | Render Static Site | HTTPS |
| App Cozinha | Render Static Site | HTTPS |
| API Django/Gunicorn | VPS Hostinger | HTTPS, somente pelo Caddy |
| PostgreSQL | VPS Hostinger | Sem porta pública |

O `render.yaml` cria somente os três sites estáticos. A pasta `deploy/` contém
o pacote Docker da API, PostgreSQL e proxy HTTPS da VPS. A separação evita pagar
um serviço de backend na Render e mantém o banco próximo da API, sem expô-lo à
internet.

## Endereços

Antes da publicação, confirme os endereços definitivos. Um exemplo de matriz é:

| Uso | Exemplo | Destino DNS |
| --- | --- | --- |
| Dashboard | `painel.seudominio.com.br` | Render |
| Alunos | `alunos.seudominio.com.br` | Render |
| Cozinha | `cozinha.seudominio.com.br` | Render |
| API | `api.seudominio.com.br` | IP público da VPS |

Os nomes acima são exemplos. Não publique o sistema com `example.com` ou
`seudominio.com.br` nas configurações.

## Ordem de implantação

1. Provisione a VPS, instale Docker com Compose e limite o firewall a SSH
   administrativo e portas públicas 80/443.
2. Crie o registro DNS da API apontando para a VPS.
3. Copie `deploy/compose.env.example` para `deploy/.env`, preencha todos os
   valores e restrinja esse arquivo ao administrador do servidor.
4. Suba `db`, `api` e `proxy` conforme [deploy/README.md](deploy/README.md).
5. Confirme `https://api.DOMINIO/api/health/` antes de criar os sites.
6. Na Render, aplique o Blueprint da raiz e preencha as variáveis obrigatórias:
   - Dashboard: `VITE_API_URL=https://api.DOMINIO/api`
   - Alunos e Cozinha: `VITE_API_BASE=https://api.DOMINIO`
7. Confirme as três origens geradas pela Render. Grave exatamente essas origens
   em `DASHBOARD_ORIGIN`, `ALUNOS_ORIGIN` e `COZINHA_ORIGIN` na VPS e reinicie a
   API. Se usar domínios próprios, troque os endereços `.onrender.com` pelos
   domínios finais.
8. Valide login, permissões, PINs, produção, estoque, relatórios, CORS, CSRF e
   fila offline nos endereços reais.

As URLs da API são incorporadas ao JavaScript no build. Uma alteração nelas
exige novo deploy dos sites. As variáveis são públicas por natureza; nenhum
segredo deve começar com `VITE_`.

## Render

O Blueprint declara os serviços `edustock-dashboard`, `edustock-alunos` e
`edustock-cozinha`. Cada site:

- instala dependências com lockfile e gera o build Vite;
- falha antes do build se a URL da API estiver ausente, for HTTP, apontar para
  localhost ou ainda for um endereço de exemplo;
- possui fallback de SPA para que rotas internas possam ser atualizadas;
- publica cabeçalhos básicos de segurança;
- só faz deploy automático depois que as verificações do commit passam.

Enquanto o domínio definitivo da API não estiver definido, a política CSP
aceita conexões HTTPS em geral. Antes do go-live definitivo, substitua
`connect-src 'self' https:` no `render.yaml` pelo host exato da API.

## Hostinger

Somente o Caddy publica portas na VPS. API e banco conversam por redes Docker;
o PostgreSQL não possui mapeamento de porta no host. O Caddy emite e renova o
certificado TLS quando DNS, portas e e-mail ACME estiverem corretos.

Configurações obrigatórias incluem segredos diferentes para Django, PINs e
banco, `APP_ENV=production`, `DEBUG=False`, host da API e as três origens HTTPS.
Não troque `PIN_LOOKUP_SECRET` depois de cadastrar PINs: isso impede a
localização dos registros existentes.

## Backups e atualização

O pacote inclui backup lógico com checksum e cópia externa por `rclone`, além
de restauração de teste em banco isolado. Configure as rotinas de
`deploy/cron.example` somente após executar ambas manualmente com sucesso.

Antes de atualizar:

1. gere um backup externo e valide o checksum;
2. confira migrations e compatibilidade da versão;
3. publique uma imagem identificada por revisão, não apenas `latest`;
4. aplique a atualização e acompanhe os logs;
5. valide health, autenticação e um fluxo crítico completo.

Não use `docker compose down --volumes` em uma instalação com dados. Voltar a
imagem antiga não desfaz automaticamente migrations do banco.

## Estado da entrega

Este repositório prepara e valida a configuração. Provisionamento da VPS,
configuração dos domínios, segredos, cópia externa e homologação autenticada nos
endereços reais continuam sendo ações de implantação e não são comprovadas por
testes locais ou CI.
