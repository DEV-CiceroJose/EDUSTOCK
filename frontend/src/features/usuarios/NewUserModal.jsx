import { useState } from "react"
import Modal from "../../components/ui/Modal"
import { getToken } from "../../lib/auth"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"
const MODULOS = ["inventario", "movimentacoes", "fornecedores", "alertas", "relatorios", "merenda", "financeiro"]

export default function NewUserModal({ open, onClose, onCreated }) {
  if (!open) return null
  return <NewUserForm onClose={onClose} onCreated={onCreated} />
}

function NewUserForm({ onClose, onCreated }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [papel, setPapel] = useState("OPERADOR")
  const [modulos, setModulos] = useState([])
  const [erro, setErro] = useState("")
  const [salvando, setSalvando] = useState(false)

  async function submit(ev) {
    ev.preventDefault()
    setErro("")
    setSalvando(true)
    try {
      const resp = await fetch(`${BASE}/usuarios/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` },
        body: JSON.stringify({ username, password, papel, modulos }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setErro(data.username?.[0] || data.detail || "Não foi possível criar o usuário.")
        return
      }
      onCreated(data)
      onClose()
    } catch {
      setErro("Falha na conexão. Tente novamente.")
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo usuário" subtitle="Cadastre um acesso à plataforma" maxW="max-w-sm">
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
        {papel === "OPERADOR" && (
          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-semibold">Módulos permitidos</legend>
            <p className="mb-2 text-xs text-ink-faint">Selecione ao menos um módulo para um novo operador.</p>
            <div className="grid grid-cols-2 gap-2">
              {MODULOS.map((slug) => (
                <label key={slug} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={modulos.includes(slug)}
                    onChange={() => setModulos((atuais) => (
                      atuais.includes(slug) ? atuais.filter((item) => item !== slug) : [...atuais, slug]
                    ))}
                  />
                  {slug}
                </label>
              ))}
            </div>
          </fieldset>
        )}
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
            disabled={!username.trim() || !password.trim() || (papel === "OPERADOR" && modulos.length === 0) || salvando}
            className="btn btn-brand disabled:opacity-50"
          >
            {salvando ? "Criando…" : "Criar usuário"}
          </button>
        </div>
      </form>
    </Modal>
  )
}
