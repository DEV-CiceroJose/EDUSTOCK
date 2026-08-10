import { useEffect, useState } from "react"
import { getToken, ehAdmin } from "../lib/auth"
import { useToast } from "../components/ui/useToast"
import { Icon } from "../lib/icons.jsx"
import NewUserModal from "../features/usuarios/NewUserModal"
import ResetPasswordModal from "../features/usuarios/ResetPasswordModal"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"
const PAPEIS = [
  { value: "OPERADOR", label: "Operador" },
  { value: "ADMIN", label: "Administrador" },
]
const MODULOS = ["inventario", "movimentacoes", "fornecedores", "alertas", "relatorios", "merenda", "financeiro"]

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [usuarioParaRedefinir, setUsuarioParaRedefinir] = useState(null)
  const toast = useToast()

  useEffect(() => {
    if (!ehAdmin()) return undefined
    let active = true
    fetch(`${BASE}/usuarios/?page_size=500`, {
      headers: { Authorization: `Token ${getToken()}` },
    })
      .then((response) => response.json())
      .then((data) => {
        if (active) setUsuarios(Array.isArray(data) ? data : (data.results ?? []))
      })
      .finally(() => {
        if (active) setCarregando(false)
      })
    return () => { active = false }
  }, [])

  async function trocarPapel(usuario, novoPapel) {
    const anterior = usuario.papel
    setUsuarios((lista) => lista.map((u) => (u.id === usuario.id ? { ...u, papel: novoPapel } : u)))
    const resp = await fetch(`${BASE}/usuarios/${usuario.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` },
      body: JSON.stringify({ papel: novoPapel }),
    })
    if (!resp.ok) {
      setUsuarios((lista) => lista.map((u) => (u.id === usuario.id ? { ...u, papel: anterior } : u)))
      toast("Não foi possível alterar o papel.", "danger")
    }
  }

  async function trocarModulo(usuario, slug) {
    const anteriores = usuario.modulos ?? []
    const novos = anteriores.includes(slug)
      ? anteriores.filter((item) => item !== slug)
      : [...anteriores, slug]
    setUsuarios((lista) => lista.map((u) => (u.id === usuario.id ? { ...u, modulos: novos } : u)))
    const resp = await fetch(`${BASE}/usuarios/${usuario.id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` },
      body: JSON.stringify({ modulos: novos }),
    })
    if (!resp.ok) {
      setUsuarios((lista) => lista.map((u) => (u.id === usuario.id ? { ...u, modulos: anteriores } : u)))
      toast("Não foi possível alterar os módulos.", "danger")
    }
  }

  async function trocarEstado(usuario) {
    const ativo = usuario.is_active !== false
    const acao = ativo ? "desativar" : "ativar"
    if (!window.confirm(`Deseja ${acao} o usuário ${usuario.username}?`)) return

    if (!ativo) {
      setUsuarios((lista) => lista.map((item) => (item.id === usuario.id ? { ...item, is_active: true } : item)))
    }
    try {
      const resposta = await fetch(`${BASE}/usuarios/${usuario.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` },
        body: JSON.stringify({ is_active: !ativo }),
      })
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}))
        if (!ativo) {
          setUsuarios((lista) => lista.map((item) => (item.id === usuario.id ? { ...item, is_active: false } : item)))
        }
        toast(dados.detail || `Não foi possível ${acao} o usuário.`, "danger")
        return
      }
      if (ativo) {
        setUsuarios((lista) => lista.map((item) => (item.id === usuario.id ? { ...item, is_active: false } : item)))
      }
      toast(`Usuário ${ativo ? "desativado" : "ativado"}.`)
    } catch {
      if (!ativo) {
        setUsuarios((lista) => lista.map((item) => (item.id === usuario.id ? { ...item, is_active: false } : item)))
      }
      toast("Falha na conexão. Tente novamente.", "danger")
    }
  }

  async function revogarSessoes(usuario) {
    if (!window.confirm(`Deseja revogar todas as sessões de ${usuario.username}?`)) return
    try {
      const resposta = await fetch(`${BASE}/usuarios/${usuario.id}/revogar-sessoes/`, {
        method: "POST",
        headers: { Authorization: `Token ${getToken()}` },
      })
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}))
        toast(dados.detail || "Não foi possível revogar as sessões.", "danger")
        return
      }
      toast("Sessões revogadas.")
    } catch {
      toast("Falha na conexão. Tente novamente.", "danger")
    }
  }

  function aoCriar(novoUsuario) {
    setUsuarios((lista) => [...lista, novoUsuario].sort((a, b) => a.username.localeCompare(b.username)))
    toast("Usuário criado")
  }

  if (!ehAdmin()) {
    return <p className="p-6 text-ink-soft">Apenas administradores acessam esta página.</p>
  }
  if (carregando) return <p className="p-6 text-ink-soft">Carregando usuários…</p>

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Usuários</h1>
        <button onClick={() => setModalOpen(true)} className="btn btn-brand">
          {Icon.plus(16)} Novo usuário
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {usuarios.map((u) => (
          <div key={u.id} className="card p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="font-semibold">{u.username}</p>
            <select
              value={u.papel}
              onChange={(e) => trocarPapel(u, e.target.value)}
              className="field w-auto"
            >
              {PAPEIS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            </div>
            {u.papel === "OPERADOR" && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {MODULOS.map((slug) => (
                  <label key={slug} className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={(u.modulos ?? []).includes(slug)}
                      onChange={() => trocarModulo(u, slug)}
                    />
                    {slug}
                  </label>
                ))}
                {(u.modulos ?? []).length === 0 && <span className="text-xs text-ink-faint">Todos os módulos ativos</span>}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
              <button onClick={() => trocarEstado(u)} className="btn btn-ghost text-sm">
                {u.is_active === false ? `Ativar ${u.username}` : `Desativar ${u.username}`}
              </button>
              <button onClick={() => setUsuarioParaRedefinir(u)} className="btn btn-ghost text-sm">
                Redefinir senha de {u.username}
              </button>
              <button onClick={() => revogarSessoes(u)} className="btn btn-ghost text-sm">
                Revogar sessões de {u.username}
              </button>
            </div>
          </div>
        ))}
      </div>
      <NewUserModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={aoCriar} />
      <ResetPasswordModal
        open={Boolean(usuarioParaRedefinir)}
        usuario={usuarioParaRedefinir}
        onClose={() => setUsuarioParaRedefinir(null)}
        onSuccess={() => toast("Senha redefinida e sessões revogadas.")}
      />
    </div>
  )
}
