export function OfflineQueueStatus({ entries, onRetry, onRemove }) {
  const attention = entries.filter((entry) => entry.status === "attention")
  const pending = entries.filter((entry) => entry.status === "pending")
  if (!entries.length) return null
  return (
    <section aria-label="Sincronização pendente">
      <p>{pending.length} pendente(s) · {attention.length} requer(em) atenção</p>
      <button type="button" onClick={onRetry}>Tentar novamente</button>
      {entries.map((entry) => (
        <button key={entry.id} type="button" onClick={() => onRemove(entry.id)}>
          {entry.status === "attention"
            ? "Remover registro rejeitado"
            : "Remover registro pendente"}
        </button>
      ))}
    </section>
  )
}
