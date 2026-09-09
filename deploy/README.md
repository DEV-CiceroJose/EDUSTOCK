# Publicação online na VPS

Este pacote preserva a arquitetura Django/PostgreSQL e os três aplicativos.
Somente o proxy publica portas 80 e 443; API e banco ficam na rede dos containers.
O PostgreSQL e os certificados têm volumes persistentes. Não usar
`docker compose down --volumes` em uma instalação com dados.

## Preparação

Publicar uma revisão aprovada pela CI em uma VPS com Docker Compose. Criar os
registros DNS de painel, alunos, cozinha e API apontando para o IP da máquina.
O domínio e o IP devem ser confirmados na conta, sem reutilizar exemplos.

Copiar `compose.env.example` para `.env` nesta pasta e preencher quatro hosts e
três segredos aleatórios distintos. Usar senha hexadecimal para o banco. Restringir
o arquivo ao administrador do servidor (`chmod 600 .env`); nunca versioná-lo.
Preservar esse arquivo e os volumes nas atualizações. Alterar PIN_LOOKUP_SECRET
em banco existente invalida a localização dos PINs cadastrados.

Com o diretório atual nesta pasta:

```sh
docker compose --env-file .env -f compose.yml config --quiet
docker compose --env-file .env -f compose.yml build
docker compose --env-file .env -f compose.yml up -d
docker compose --env-file .env -f compose.yml ps
```

O primeiro início aplica migrações e coleta estáticos antes do Gunicorn. O Caddy
obtém os certificados automaticamente quando DNS e portas estiverem acessíveis.
Não publicar os arquivos `.env`, dumps nem o diretório do projeto pelo proxy.

Criar o gestor e sua escola/vínculo no banco novo, com senha única; não ativar
DEMO_MODE nem executar carga de demonstração sobre banco com dados reais.

## Verificação e recuperação

Antes de entregar os acessos: conferir saúde da API, login/logout, isolamento de
escolas, PIN, importação, entrega/estoque e relatórios pelos quatro hosts reais.
Reiniciar os serviços e confirmar preservação dos dados. Os testes E2E da CI usam
respostas simuladas; não substituem essa homologação.

Gerar um backup PostgreSQL antes de cada atualização, usando `pg_dump -Fc` pelo
serviço `db`, e armazenar uma cópia protegida fora da VPS. Testar `pg_restore` em
um banco separado, nunca sobre o banco em uso. Backups locais ou snapshots sem
cópia externa não cobrem perda da VPS. Guardar também os segredos em local seguro.

Uma atualização de código pode aplicar migrações; voltar apenas a imagem antiga
não garante reversão do esquema. Avaliar compatibilidade das migrações e manter
backup restaurável antes de atualizar.

## Estado desta entrega

Pacote de publicação preparado para homologação. A CI valida Compose, imagens e
configuração do proxy. Registro do domínio, provisionamento da VPS, instalação,
teste de restauração e validação autenticada real precisam ser confirmados antes
de declarar a instalação concluída. Entregas offline não estão implementadas.
