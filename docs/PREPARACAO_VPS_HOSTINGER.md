# Preparação da VPS Hostinger

## Escopo atual

A VPS executa somente Caddy, API Django/Gunicorn e PostgreSQL. Dashboard,
Alunos e Cozinha são sites estáticos na Render. O banco e a API permanecem na
mesma máquina e o PostgreSQL não recebe porta pública.

O pacote reproduzível está em `deploy/`. Nenhum recurso remoto é criado apenas
por incluir esses arquivos no repositório.

## Preparação do servidor

1. Confirme proprietário da conta, plano, região, IP e política de backup.
2. Instale Docker Engine e o plugin Docker Compose.
3. Crie um usuário administrativo com chave SSH e restrinja a porta SSH aos
   endereços autorizados quando possível.
4. Libere publicamente somente 80 e 443; não publique 5432 nem 8000.
5. Aponte o DNS de `API_HOST` para a VPS.
6. Instale o projeto em um diretório dedicado, por exemplo `/opt/edustock`.
7. Configure `deploy/.env` e `rclone` sem versionar credenciais.
8. Execute a instalação e a verificação descritas em
   [../deploy/README.md](../deploy/README.md).

## Critérios de liberação

- certificado válido e redirecionamento HTTPS;
- health da API em HTTP 200;
- PostgreSQL e porta do Gunicorn inacessíveis externamente;
- CORS permite somente as três origens finais;
- login/logout, revogação, papéis e isolamento entre escolas validados;
- PINs de Alunos e Cozinha validados nos domínios reais;
- produção da merenda e fila offline testadas após reconexão;
- reinício da pilha preserva dados;
- backup externo e restauração em banco temporário comprovados;
- responsável, janela de manutenção e resposta a incidentes definidos.

Testes locais e CI comprovam o formato da configuração, não a segurança do
firewall, o DNS, os recursos da VPS nem o funcionamento autenticado em produção.
