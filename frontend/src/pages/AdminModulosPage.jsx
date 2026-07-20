import { useEffect, useState } from "react"
import { getToken, ehAdmin } from "../lib/auth"
import { useToast } from "../components/ui/Toast"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

export default function AdminModulosPage() {
  const [modulos, setModulos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const toast = useToast()

  useEffect(() => {
    if (ehAdmin()) carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const resp = await fetch(`${BASE}/modulos/`, {
      headers: { Authorization: `Token ${getToken()}` },
    })
    const data = await resp.json()
    setModulos(data)
    setCarregando(false)
  }

  async function togglear(slug, ativo) {
    const resp = await fetch(`${BASE}/modulos/${slug}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` },
      body: JSON.stringify({ ativo: !ativo }),
    })
    if (!resp.ok) {
      const data = await resp.json()
      toast(data.detail || "Não foi possível alterar o módulo.", "danger")
      return
    }
    carregar()
  }

  if (!ehAdmin()) {
    return <p className="p-6 text-ink-soft">Apenas administradores acessam esta página.</p>
  }
  if (carregando) return <p className="p-6 text-ink-soft">Carregando módulos…</p>

  return (
    <div className="p-6">
      <h1 className="mb-4 font-display text-xl font-bold">Módulos do sistema</h1>
      <div className="flex flex-col gap-2">
        {modulos.map((m) => (
          <div key={m.slug} className="card flex items-center justify-between p-4">
            <div>
              <p className="font-semibold">{m.nome}</p>
              <p className="text-sm text-ink-soft">{m.descricao}</p>
            </div>
            <button
              onClick={() => togglear(m.slug, m.ativo)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                m.ativo ? "bg-brand text-white" : "bg-surface-2 text-ink-soft"
              }`}
            >
              {m.ativo ? "Ativo" : "Inativo"}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
