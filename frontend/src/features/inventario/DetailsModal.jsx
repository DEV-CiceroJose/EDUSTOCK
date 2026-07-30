import Modal from "../../components/ui/Modal"
import { Icon } from "../../lib/icons.jsx"
import { categoryStyle } from "../../lib/catalog"
import { brl, qtd, dataBR, stockStatus, validadeStatus } from "../../lib/format"
import { unidadeLabel } from "../../api/units"
import { getModulosAtivos } from "../../lib/auth"

function Linha({ label, children }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2.5 last:border-0">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="text-sm font-semibold">{children}</span>
    </div>
  )
}

export default function DetailsModal({ produto, onClose, onEdit, onDelete, onAdd, onRemove, canManage = true }) {
  if (!produto) return null
  const mostrarPreco = getModulosAtivos().includes("financeiro")
  const st = categoryStyle(produto.categoria_nome)
  const stock = stockStatus(produto.quantidade, produto.estoque_minimo)
  const val = validadeStatus(produto.validade)

  return (
    <Modal open={!!produto} onClose={onClose} title="Detalhes do item" subtitle={`${produto.categoria_nome} › ${produto.grupo_nome ?? ""}`}>
      <div className="flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl" style={{ background: st.tint, color: st.fg }}>
          {st.renderIcon(28)}
        </div>
        <div>
          <h3 className="font-display text-xl font-bold leading-tight">{produto.nome}</h3>
          <span className={`tag tag-${stock.code} mt-1`}>
            <span className="dot" /> {stock.label}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-surface-2/40 px-4">
        <Linha label="Quantidade atual">
          {qtd(produto.quantidade)} {unidadeLabel(produto.unidade).toLowerCase()}
        </Linha>
        {mostrarPreco && (
          <>
            <Linha label="Preço unitário">{brl(produto.preco)}</Linha>
            <Linha label="Valor em estoque">
              {produto.preco ? brl(Number(produto.preco) * Number(produto.quantidade)) : "—"}
            </Linha>
          </>
        )}
        <Linha label="Validade">
          {produto.validade ? (
            <span className={val.code === "expired" ? "text-out" : val.code === "soon" ? "text-low" : ""}>
              {dataBR(produto.validade)} {val.dias != null && `(${val.label})`}
            </span>
          ) : "Sem validade"}
        </Linha>
        {produto.numero_nota_fiscal && (
          <Linha label="NF (legado)">{produto.numero_nota_fiscal}</Linha>
        )}
        <Linha label="Estoque mínimo">{qtd(produto.estoque_minimo)} {unidadeLabel(produto.unidade).toLowerCase()}</Linha>
        <Linha label="Periodicidade">{produto.periodicidade ?? "—"}</Linha>
        <Linha label="Fornecedor">{produto.fornecedor_nome || "—"}</Linha>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button 
          onClick={() => onAdd(produto)} 
          className="btn px-3" 
          style={{ background: "var(--color-ok-tint)", color: "var(--color-ok)" }}
        >
          {Icon.plus(16)} Adicionar
        </button>
        <button 
          onClick={() => onRemove(produto)} 
          className="btn px-3" 
          style={{ background: "var(--color-out-tint)", color: "var(--color-out)" }}
          disabled={Number(produto.quantidade) <= 0}
        >
          {Icon.minus(16)} Retirar
        </button>
        {canManage && (
          <>
            <button onClick={() => onEdit(produto)} className="btn btn-brand">
              {Icon.edit(16)} Editar
            </button>
            <button
              onClick={() => onDelete(produto)}
              className="btn px-3"
              style={{ background: "var(--color-out-tint)", color: "var(--color-out)" }}
            >
              {Icon.trash(16)} Excluir
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
