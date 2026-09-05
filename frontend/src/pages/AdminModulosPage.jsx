import { fetchAutenticado } from "../lib/authenticatedFetch"
import { useEffect, useState } from "react"
import { getToken, ehAdmin } from "../lib/auth"
import { useToast } from "../components/ui/useToast"
import DataLoadError from "../components/ui/DataLoadError"

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api"

export default function AdminModulosPage() {
  const [modulos, setModulos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [revision, setRevision] = useState(0)
  const toast = useToast()

  useEffect(() => {
    if (!ehAdmin()) return undefined
    let active = true
    fetchAutenticado(`${BASE}/modulos/?page_size=500`, {
      headers: { Authorization: `Token ${getToken()}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Falha ao carregar módulos.")
        return response.json()
      })
      .then((data) => { if (active) setModulos(Array.isArray(data) ? data : (data.results ?? [])) })
      .catch((error) => { if (active) setErro(error) })
      .finally(() => { if (active) setCarregando(false) })
    return () => { active = false }
  }, [revision])

  function carregar() {
    setErro(null)
    setCarregando(true)
    setRevision((value) => value + 1)
  }

  async function togglear(slug, ativo) {
    try {
      const resp = await fetchAutenticado(`${BASE}/modulos/${slug}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Token ${getToken()}` },
        body: JSON.stringify({ ativo: !ativo }),
      })
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        toast(data.detail || "Não foi possível alterar o módulo.", "danger")
        return
      }
      carregar()
    } catch {
      toast("Não foi possível alterar o módulo. Verifique a conexão.", "danger")
    }
  }

  if (!ehAdmin()) {
    return <p className="p-6 text-ink-soft">Apenas administradores acessam esta página.</p>
  }
  if (carregando) return <p className="p-6 text-ink-soft">Carregando módulos…</p>
  if (erro) return <div className="p-6"><DataLoadError error={erro} onRetry={carregar} /></div>

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
