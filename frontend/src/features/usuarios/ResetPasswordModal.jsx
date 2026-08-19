import { useState } from "react"
import Modal from "../../components/ui/Modal"
import { getToken } from "../../lib/auth"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

export default function ResetPasswordModal({ open, usuario, onClose, onSuccess }) {
  if (!open || !usuario) return null
  return <ResetPasswordForm usuario={usuario} onClose={onClose} onSuccess={onSuccess} />
}

function ResetPasswordForm({ usuario, onClose, onSuccess }) {
  const [password, setPassword] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [erro, setErro] = useState("")
  const [salvando, setSalvando] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (password !== confirmacao) {
      setErro("As senhas não coincidem.")
      return
    }
    setErro("")
    setSalvando(true)
    try {
      const resposta = await fetch(`${BASE}/usuarios/${usuario.id}/senha/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` },
        body: JSON.stringify({ password }),
      })
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}))
        setErro(dados.password?.[0] || dados.detail || "Não foi possível redefinir a senha.")
        return
      }
      onSuccess()
      onClose()
    } catch {
      setErro("Falha na conexão. Tente novamente.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Redefinir senha de ${usuario.username}`} subtitle="A pessoa terá de entrar novamente.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Nova senha</span>
          <input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Confirmar nova senha</span>
          <input type="password" value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} className="field" />
        </label>
        {erro && <p className="text-sm text-out" role="alert">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button type="submit" disabled={!password || !confirmacao || salvando} className="btn btn-brand disabled:opacity-50">
            {salvando ? "Redefinindo…" : "Confirmar redefinição"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
