# Monitoramento e backup do EduStock

## Verificação automática

O backend disponibiliza `GET /api/health/`, sem autenticação. A resposta não expõe credenciais ou detalhes de infraestrutura e confirma apenas:

- comunicação com o banco de dados;
- leitura e escrita no cache de sessões;
- horário da verificação.

O serviço web no Render usa esse endereço como `healthCheckPath`. Uma resposta diferente de HTTP 200 deve impedir que uma instância sem banco ou cache seja considerada saudável.

## Rotina de acompanhamento

1. Conferir o health check antes do início das aulas.
2. Conferir no app Alunos se a sincronização diária responde.
3. Conferir no app Cozinha se as três refeições aparecem e se o histórico abre.
4. Investigar respostas 429 como tentativas repetidas de PIN; não aumentar o limite sem avaliar os registros do servidor.
5. Trocar ou desativar imediatamente um PIN exposto. As sessões abertas por esse PIN serão revogadas na próxima chamada à API.

## Backup do banco de produção

Usar o backup gerenciado do PostgreSQL do Render como fonte principal. Antes de migrations, alterações de PIN em massa ou importações:

1. criar um backup completo;
2. registrar data, horário e responsável;
3. confirmar que o arquivo ou snapshot possui tamanho válido;
4. manter a cópia em armazenamento protegido e com acesso restrito;
5. executar periodicamente uma restauração em ambiente separado.

Os dados de `PinAcesso` são protegidos por hash, mas o backup continua sendo sensível porque contém usuários, movimentações e histórico operacional. Não anexar backups a commits, e-mails ou chamados públicos.

## Recuperação

1. Interromper temporariamente novas movimentações.
2. Restaurar o backup em uma instância isolada.
3. executar as migrations da mesma versão da aplicação;
4. validar `/api/health/`;
5. testar login administrativo, PIN de aluno e PIN da cozinha;
6. somente então liberar novamente o acesso dos usuários.
