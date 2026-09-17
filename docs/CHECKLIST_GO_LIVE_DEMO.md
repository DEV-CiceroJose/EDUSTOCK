# Checklist de go-live

Use este checklist depois da implantação híbrida e novamente antes de liberar
os links. Marque somente itens comprovados no ambiente atual.

## Segurança e configuração

- [ ] Nenhum segredo, PIN, dump ou `.env` está versionado.
- [ ] `SECRET_KEY`, `PIN_LOOKUP_SECRET` e senha do banco são fortes e
  diferentes.
- [ ] A Render contém somente as URLs públicas de build dos frontends.
- [ ] A VPS usa `APP_ENV=production`, `DEBUG=False` e `DEMO_MODE=False`.
- [ ] CORS e CSRF permitem exatamente Dashboard, Alunos e Cozinha.
- [ ] PostgreSQL e Gunicorn não possuem portas públicas.
- [ ] Firewall, acesso SSH e atualizações do sistema foram revisados.

## Deploy e saúde

- [ ] `edustock-dashboard`, `edustock-alunos` e `edustock-cozinha` concluíram o
  build da mesma revisão aprovada.
- [ ] `db`, `api` e `proxy` estão saudáveis na VPS.
- [ ] `GET https://API_HOST/api/health/` retorna HTTP 200.
- [ ] DNS e certificados dos quatro endereços são válidos.
- [ ] Atualizar uma rota interna dos três sites não retorna 404.
- [ ] O navegador não registra erros de CORS, CSRF, conteúdo misto ou CSP.

## Dashboard administrativo

- [ ] A landing pública abre e o contato funciona.
- [ ] `/login` aceita conta administrativa autorizada.
- [ ] A conta de operador entra e respeita suas permissões.
- [ ] Troca de escola não mistura dados de unidades diferentes.
- [ ] Entrada, movimentação, inventário e relatório usam a API publicada.
- [ ] Logout revoga a sessão e o token encerrado não volta a funcionar.

## App Alunos

- [ ] `/login` aceita apenas um PIN válido do perfil correto.
- [ ] `/registrar` mostra a turma esperada.
- [ ] Uma contagem é confirmada uma única vez.
- [ ] PIN incorreto apresenta erro e não libera a rota protegida.

## App Cozinha

- [ ] `/login` aceita apenas um PIN válido do perfil correto.
- [ ] `/producao` abre sem encerrar uma sessão válida.
- [ ] Plano, produção e baixa atualizam o inventário corretamente.
- [ ] PIN incorreto apresenta erro e não libera a rota protegida.

## Fila offline

- [ ] Com a rede desligada, uma operação suportada permanece pendente e visível.
- [ ] A pendência pode ser reenviada ou removida pelo usuário.
- [ ] Erro de autenticação conserva a fila e solicita novo login.
- [ ] Ao restaurar a rede, a sincronização registra a ação apenas uma vez.
- [ ] Recarregar o app não apaga silenciosamente pendências válidas.

## Backup e recuperação

- [ ] O backup manual produz dump e checksum válidos.
- [ ] A cópia chega ao destino externo à VPS.
- [ ] A restauração em banco temporário conclui sem alterar o banco ativo.
- [ ] A rotina agendada informa falhas ao responsável.
- [ ] Retenção, RPO, RTO e responsáveis estão documentados.
- [ ] Reiniciar a pilha preserva os dados e os certificados.

## Logs e operação

- [ ] Logs não exibem senhas, PINs, tokens, segredos ou URL do banco.
- [ ] Existe monitor externo para o health e alerta de recursos da VPS.
- [ ] Há procedimento de atualização, rollback compatível com migrations e
  resposta a incidentes.
- [ ] Links e credenciais são entregues somente a pessoas autorizadas.
- [ ] O responsável registrou revisão, data e resultado desta homologação.
