import { useMemo, useState } from "react"
import { motion } from "motion/react"
import { fornecedoresApi } from "../../api"
import { Icon } from "../../lib/icons.jsx"
import ConfirmDialog from "../../components/ui/ConfirmDialog"
import { useToast } from "../../components/ui/Toast"

const CHIPS = [
  { key: "todos", label: "Todos" },
  { key: "nf", label: "Emite NF" },
  { key: "fiado", label: "Aceita fiado" },
  { key: "inativos", label: "Inativos" },
]

function Badge({ tone, children }) {
  const cls = {
    ok: "bg-ok-tint text-ok",
    warn: "bg-low-tint text-low",
    off: "bg-ink/5 text-ink-faint",
  }[tone]
  return <span className={`rounded-full px-2 py-0.5 text-[0.66rem] font-bold uppercase ${cls}`}>{children}</span>
}

export default function FornecedoresView({ fornecedores, onNew, onEdit, onChanged, canManage = true }) {
  const [filtro, setFiltro] = useState("todos")
  const [aExcluir, setAExcluir] = useState(null)
  const toast = useToast()

  const lista = useMemo(() => {
    if (filtro === "nf") return fornecedores.filter((f) => f.emite_nota_fiscal)
    if (filtro === "fiado") return fornecedores.filter((f) => f.aceita_fiado)
    if (filtro === "inativos") return fornecedores.filter((f) => !f.ativo)
    return fornecedores
  }, [fornecedores, filtro])

  async function toggleAtivo(f) {
    await fornecedoresApi.update(f.id, { ativo: !f.ativo })
    toast(f.ativo ? "Fornecedor desativado" : "Fornecedor ativado")
    onChanged?.()
  }

  async function excluir() {
    const f = aExcluir
    setAExcluir(null)
    try {
      await fornecedoresApi.remove(f.id)
      toast(`"${f.nome}" excluído`, "danger")
      onChanged?.()
    } catch (err) {
      toast(String(err.message || err), "danger")
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold leading-none">Fornecedores</h2>
          <p className="mt-1 text-sm text-ink-faint">{lista.length} {lista.length === 1 ? "fornecedor" : "fornecedores"}</p>
        </div>
        {canManage && <button onClick={onNew} className="btn btn-brand">{Icon.plus(18)} Novo fornecedor</button>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            onClick={() => setFiltro(c.key)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
              filtro === c.key ? "border-brand bg-brand text-[#f4f1e7]" : "border-line bg-surface text-ink-soft hover:bg-surface-2"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {lista.length === 0 && (
          <div className="col-span-full grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
            <span className="mb-2 text-ink-faint">{Icon.users(40)}</span>
            <p className="font-display text-lg font-bold">Nenhum fornecedor</p>
            <p className="text-sm text-ink-faint">Cadastre o primeiro com "Novo fornecedor".</p>
          </div>
        )}

        {lista.map((f, i) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3) }}
            className={`card flex flex-col p-4 ${f.ativo ? "" : "opacity-70"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold leading-tight" title={f.nome}>{f.nome}</h3>
                {f.documento && <div className="font-mono text-[0.66rem] text-ink-faint">{f.documento}</div>}
              </div>
              {canManage && (
                <button onClick={() => onEdit(f)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-faint hover:bg-surface-2" title="Editar">
                  {Icon.edit(15)}
                </button>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {f.emite_nota_fiscal && <Badge tone="ok">NF</Badge>}
              {f.aceita_fiado && <Badge tone="warn">Fiado</Badge>}
              {!f.ativo && <Badge tone="off">Inativo</Badge>}
            </div>

            {(f.telefone || f.email || f.endereco) && (
              <div className="mt-3 space-y-0.5 text-xs text-ink-soft">
                {f.telefone && <div>📞 {f.telefone}</div>}
                {f.email && <div className="truncate">✉ {f.email}</div>}
                {f.endereco && <div className="truncate">📍 {f.endereco}</div>}
              </div>
            )}

            {canManage && <div className="mt-3 flex gap-1.5 border-t border-line pt-3">
              <button onClick={() => toggleAtivo(f)} className="btn btn-ghost flex-1 py-1.5 text-xs">
                {f.ativo ? "Desativar" : "Ativar"}
              </button>
              <button
                onClick={() => setAExcluir(f)}
                className="btn px-3 py-1.5 text-xs"
                style={{ background: "var(--color-out-tint)", color: "var(--color-out)" }}
              >
                {Icon.trash(15)}
              </button>
            </div>}
          </motion.div>
        ))}
      </div>

      {canManage && <ConfirmDialog
        open={!!aExcluir}
        title="Excluir fornecedor"
        message={aExcluir ? `Remover "${aExcluir.nome}"? Se estiver vinculado a produtos, desative em vez de excluir.` : ""}
        onConfirm={excluir}
        onCancel={() => setAExcluir(null)}
      />}
    </div>
  )
}
