# Checklist de go-live da demonstração

Use este checklist após o deploy e novamente antes de compartilhar os links.
Marque somente itens verificados na publicação atual.

## Segurança e validade

- [ ] Todos os dados são fictícios e descartáveis.
- [ ] Nenhum nome, documento, e-mail, estoque ou histórico real foi inserido.
- [ ] As sete variáveis `DEMO_*` secretas existem apenas na Render e no
  gerenciador de senhas autorizado.
- [ ] Usuários, senhas e PINs são exclusivos desta demonstração.
- [ ] `DEMO_EXPIRES_AT` está no futuro, com fuso, e a data foi registrada.
- [ ] A data de criação e de expiração em 30 dias do PostgreSQL Free foi
  registrada e possui aviso.
- [ ] Não existe `.env.production` versionado.

## Deploy e saúde

- [ ] `edustock-demo-db` está disponível.
- [ ] `edustock-demo-api` concluiu build, migrations e `preparar_demo`.
- [ ] `edustock-demo-dashboard` concluiu o build.
- [ ] `edustock-demo-alunos` concluiu o build.
- [ ] `edustock-demo-cozinha` concluiu o build.
- [ ] `GET https://edustock-demo-api.onrender.com/api/health/` retorna HTTP 200.
- [ ] O despertar após inatividade foi explicado aos avaliadores.

## Dashboard administrativo

- [ ] A landing pública abre.
- [ ] `/login` aceita a conta administrativa fictícia.
- [ ] A conta de operador fictícia entra e respeita as permissões esperadas.
- [ ] `/inventario` mostra somente produtos, lotes e fornecedor fictícios.
- [ ] Uma entrada fictícia pode ser registrada e atualiza o estoque.
- [ ] `/movimentacoes` exibe a entrada e sua trilha de auditoria.
- [ ] Um administrador consegue estornar uma movimentação com motivo válido.
- [ ] O saldo é restaurado e a correção fica vinculada à movimentação original.
- [ ] Não é possível estornar duas vezes nem estornar um estorno.

## App Alunos

- [ ] `/login` aceita somente `DEMO_ALUNOS_PIN`.
- [ ] `/registrar` identifica a turma fictícia.
- [ ] Uma contagem fictícia é confirmada uma única vez.
- [ ] PIN incorreto apresenta erro e não libera a rota protegida.

## App Cozinha

- [ ] `/login` aceita somente `DEMO_COZINHA_PIN`.
- [ ] `/producao` mostra o plano fictício esperado.
- [ ] Uma baixa fictícia é confirmada e refletida no inventário.
- [ ] PIN incorreto apresenta erro e não libera a rota protegida.

## Fila offline

- [ ] Com a rede desligada, uma operação suportada permanece pendente e visível.
- [ ] A pendência pode ser reenviada ou removida pelo usuário.
- [ ] Erro 401/403 mantém a fila e pede novo login.
- [ ] Ao restaurar a rede, a sincronização registra a ação apenas uma vez.
- [ ] Recarregar o app não apaga silenciosamente pendências válidas.

## Produção sem mock

- [ ] O dashboard exibe o aviso de demonstração.
- [ ] As telas usam a API publicada, não dados mock locais.
- [ ] Uma tentativa de habilitar mock em build de produção é bloqueada.
- [ ] Dados alterados no dashboard são observáveis pela API e pelos apps quando
  aplicável.

## Logs e observabilidade

- [ ] Logs da API não mostram senha, PIN, token, `SECRET_KEY`,
  `PIN_LOOKUP_SECRET` nem `DATABASE_URL`.
- [ ] Falhas de migration, preparação da demo, autenticação e health foram
  revisadas.
- [ ] Não há erros CORS, CSRF ou CSP no navegador durante os fluxos.
- [ ] O responsável sabe onde acompanhar horas, banda e minutos de build.

## Avisos ao avaliador

- [ ] Foi informado que a API Free dorme após 15 minutos sem tráfego.
- [ ] Foi informado que o primeiro acesso pode levar cerca de um minuto.
- [ ] Foi informado que o PostgreSQL Free expira 30 dias após a criação.
- [ ] Foi informado que o plano Free não possui backup gerenciado e não é
  adequado para produção.
- [ ] Há um contato e uma data definidos para encerrar ou renovar a demo.

## Encerramento

- [ ] Links foram compartilhados somente com os avaliadores autorizados.
- [ ] Credenciais antigas foram revogadas após a avaliação.
- [ ] Recursos expirados foram removidos ou migrados conscientemente.
- [ ] Nenhum banco demonstrativo foi promovido diretamente para produção.
