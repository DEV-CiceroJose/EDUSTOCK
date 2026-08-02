const root = document.getElementById('root')

function mostrarFalhaDeInicializacao() {
  root.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f1e7;font-family:system-ui,sans-serif">
      <section role="alert" style="width:min(100%,420px);padding:28px;border:1px solid #ded8c7;border-radius:20px;background:#fff;text-align:center;color:#17231f">
        <h1 style="margin:0 0 8px;font-size:22px">Não foi possível abrir o EduStock Alunos</h1>
        <p style="margin:0 0 20px;color:#63706a">Um arquivo antigo do aplicativo pode estar armazenado no navegador.</p>
        <button id="recarregar-app" type="button" style="width:100%;padding:14px;border:0;border-radius:14px;background:#214d3f;color:#fff;font-size:16px;font-weight:700;cursor:pointer">Recarregar aplicativo</button>
      </section>
    </main>
  `
  document.getElementById('recarregar-app')?.addEventListener('click', () => location.reload())
}

async function limparResiduosDeDesenvolvimento() {
  if (!import.meta.env.DEV) return

  if ('serviceWorker' in navigator) {
    const registros = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registros.map((registro) => registro.unregister()))
  }

  if ('caches' in globalThis) {
    const chaves = await caches.keys()
    await Promise.all(
      chaves
        .filter((chave) => chave.startsWith('edustock-alunos-'))
        .map((chave) => caches.delete(chave)),
    )
  }
}

async function iniciar() {
  try {
    await limparResiduosDeDesenvolvimento()
    const { montarAplicativo } = await import('./bootstrap.jsx')
    montarAplicativo(root)

    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch((error) => {
          console.error('Não foi possível ativar o app instalável.', error)
        })
      })
    }
  } catch (error) {
    console.error('Falha ao iniciar o EduStock Alunos.', error)
    mostrarFalhaDeInicializacao()
  }
}

void iniciar()
