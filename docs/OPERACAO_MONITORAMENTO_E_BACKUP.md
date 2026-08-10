# Operação, monitoramento e backup do EduStock

## Saúde do serviço

O backend oferece `GET /api/health/` sem autenticação. A resposta confirma banco
e cache sem expor credenciais ou detalhes internos. O serviço
`edustock-demo-api` usa essa rota como `healthCheckPath` no `render.yaml`.

Na demonstração Free, o primeiro acesso após 15 minutos sem tráfego pode levar
cerca de um minuto enquanto o serviço desperta. Durante esse intervalo, não
trate a demora inicial isolada como indisponibilidade definitiva. Depois do
despertar, uma resposta diferente de HTTP 200 exige investigação.

## Rotina da demonstração

Antes de compartilhar:

1. verificar o deploy mais recente dos quatro serviços;
2. abrir `/api/health/` e confirmar HTTP 200;
3. testar login administrativo e os dois logins por PIN;
4. executar os fluxos do checklist de go-live;
5. inspecionar os logs em busca de erros, sem copiar segredos;
6. conferir a data de `DEMO_EXPIRES_AT` e a data de expiração do banco Free;
7. confirmar que todo conteúdo exibido é fictício.

Durante a avaliação:

- respostas 429 indicam excesso de tentativas; não aumente limites sem análise;
- PIN exposto deve ser rotacionado imediatamente;
- falha de banco ou cache deve manter o health check fora de HTTP 200;
- nunca registrar senha, PIN, token, `SECRET_KEY`, `PIN_LOOKUP_SECRET` ou
  `DATABASE_URL` em chamados e capturas;
- monitorar as 750 horas mensais do workspace e os limites de banda e build.

O plano gratuito é apropriado para demonstração, não para produção. A Render
pode reiniciar instâncias Free e o filesystem do Web Service é efêmero. Dados
duráveis devem estar no PostgreSQL, nunca em SQLite local, uploads locais ou
arquivos gerados no processo web.

## Expiração e descarte

O PostgreSQL Free tem 1 GB e expira 30 dias após a criação. Após expirar, há um
período de 14 dias para upgrade; depois disso, a Render remove o banco e os
dados. Registre a data de criação e configure aviso antes da expiração.

Ao encerrar a demonstração:

1. revogue ou troque todas as credenciais compartilhadas;
2. remova acessos e dados fictícios que não precisam ser preservados;
3. desligue ou exclua os recursos conforme a política do projeto;
4. não transforme o banco demonstrativo em produção por conveniência.

## Backups

O Render Postgres Free não possui recuperação point-in-time nem backups
lógicos gerenciados. Como a demonstração contém somente dados descartáveis e
fictícios, a recuperação esperada é recriar o banco pelo Blueprint e executar
novamente `preparar_demo`.

Se for necessário preservar uma demonstração específica, faça um `pg_dump` por
uma máquina autorizada usando a URL externa temporariamente e armazene o arquivo
fora do repositório, criptografado e com acesso restrito. Nunca inclua dumps em
commits, e-mails ou chamados públicos.

## Migração para produção paga

Antes de receber dados reais:

1. atualizar `edustock-demo-api` e `edustock-demo-db` para instâncias pagas;
2. definir capacidade, retenção e janela de recuperação;
3. habilitar e testar recuperação point-in-time e exportações lógicas;
4. realizar uma restauração em ambiente isolado;
5. trocar todas as credenciais, definir `DEMO_MODE=false` e usar banco limpo;
6. revisar CORS, CSRF, domínios, logs, alertas e responsáveis;
7. executar homologação completa antes da liberação.

Bancos pagos recebem recuperação contínua de acordo com o plano do workspace.
A troca do tipo de instância pode causar alguns minutos de indisponibilidade e
deve ter janela de mudança comunicada.

## Recuperação de uma instalação paga

1. interromper novas movimentações;
2. restaurar para uma nova instância isolada;
3. validar os dados antes de alterar `DATABASE_URL`;
4. aplicar migrations da mesma versão da aplicação;
5. validar `/api/health/`, logins e operações críticas;
6. apontar os serviços para a instância recuperada;
7. liberar o acesso e registrar o incidente.

## Fontes oficiais

- [Limitações dos serviços e bancos Free](https://render.com/docs/free)
- [Planos do Render Postgres](https://render.com/docs/postgresql-refresh)
- [Recuperação, backup lógico e pg_dump](https://render.com/docs/postgresql-backups)
