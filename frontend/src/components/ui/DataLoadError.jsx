export default function DataLoadError({ error, onRetry }) {
  if (!error) return null
  return (
    <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-out/30 bg-out-tint px-4 py-3 text-sm text-out">
      <span>Não foi possível carregar todos os dados. Verifique a conexão.</span>
      <button type="button" onClick={onRetry} className="btn btn-ghost">
        Tentar novamente
      </button>
    </div>
  )
}
