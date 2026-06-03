import Modal from "./Modal"
import { Icon } from "../lib/icons.jsx"

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} maxW="max-w-md">
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-out-tint text-out">
          {Icon.alert(20)}
        </span>
        <p className="pt-1.5 text-sm text-ink-soft">{message}</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCancel} className="btn btn-ghost">Cancelar</button>
        <button
          onClick={onConfirm}
          className="btn"
          style={{ background: "var(--color-out)", color: "#fff" }}
        >
          {Icon.trash(15)} Excluir
        </button>
      </div>
    </Modal>
  )
}
