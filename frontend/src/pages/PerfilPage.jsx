import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { getToken, getUsername, getNome, atualizarNome, limparSessao } from "../lib/auth"
import { useToast } from "../components/ui/Toast"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

export default function PerfilPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [nome, setNome] = useState(getNome() || "")
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState("")

  const avatarLetter = (nome || "?").charAt(0).toUpperCase()

  async function salvarNome(ev) {
    ev.preventDefault()
    const valor = nome.trim()
    if (!valor || valor === getNome()) return
    setErro("")
    setSalvando(true)
    try {
      const resp = await fetch(`${BASE}/auth/me/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` },
        body: JSON.stringify({ nome: valor }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        setErro(data.detail || "Não foi possível salvar o nome.")
        return
      }
      atualizarNome(data.nome)
      setNome(data.nome)
      toast("Nome atualizado")
    } catch {
      setErro("Falha na conexão. Tente novamente.")
    } finally {
      setSalvando(false)
    }
  }

  const handleLogout = async () => {
    const token = getToken()
    if (token) {
      try {
        await fetch(`${BASE}/auth/logout/`, {
          method: "POST",
          headers: { Authorization: `Token ${token}` },
        })
      } catch {
        // Falha de rede não deve impedir o logout local
      }
    }

    limparSessao()
    navigate("/login")
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-8">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold leading-tight">Perfil</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-faint">
          Gerencie suas informações de perfil e sessão
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-surface text-2xl font-bold text-brand">
            {avatarLetter}
          </div>
          <div className="flex-1">
            <p className="text-sm text-ink-faint">
              Editando o perfil de <strong className="text-ink">{getUsername()}</strong>
            </p>
          </div>
        </div>

        <form onSubmit={salvarNome} className="mb-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink-faint">Nome</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="field"
            />
          </label>
          {erro && <p className="text-sm text-out">{erro}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!nome.trim() || nome.trim() === getNome() || salvando}
              className="btn btn-brand disabled:opacity-50"
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>

        <div className="flex justify-end border-t border-line pt-6">
          <button
            onClick={handleLogout}
            className="rounded-lg bg-danger px-4 py-2 font-medium text-white transition-colors hover:bg-danger/90"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
