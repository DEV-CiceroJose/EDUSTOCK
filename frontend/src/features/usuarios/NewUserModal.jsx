import { useEffect, useState } from "react"
import Modal from "../../components/ui/Modal"
import { getToken } from "../../lib/auth"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

export default function NewUserModal({ open, onClose, onCreated }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [papel, setPapel] = useState("OPERADOR")
  const [erro, setErro] = useState("")
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (open) {
      setUsername("")
      setPassword("")
      setPapel("OPERADOR")
      setErro("")
      setSalvando(false)
    }
  }, [open])

  async function submit(ev) {
    ev.preventDefault()
    setErro("")
    setSalvando(true)
    try {
      const resp = await fetch(`${BASE}/usuarios/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` },
        body: JSON.stringify({ username, password, papel }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setErro(data.username?.[0] || data.detail || "Não foi possível criar o usuário.")
        return
      }
      onCreated(data)
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo usuário" subtitle="Cadastre um acesso à plataforma" maxW="max-w-sm">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Usuário</span>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Papel</span>
          <select value={papel} onChange={(e) => setPapel(e.target.value)} className="field">
            <option value="OPERADOR">Operador</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </label>
        {erro && <p className="text-sm text-out">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
          <button
            type="submit"
            disabled={!username.trim() || !password.trim() || salvando}
            className="btn btn-brand disabled:opacity-50"
          >
            {salvando ? "Criando…" : "Criar usuário"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
