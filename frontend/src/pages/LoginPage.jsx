import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { salvarSessao } from "../lib/auth"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setErro("")
    setCarregando(true)
    try {
      const base = import.meta.env.VITE_API_URL || "http://localhost:8000/api"
      const resp = await fetch(`${base}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (!resp.ok) {
        setErro("Usuário ou senha inválidos.")
        return
      }
      const data = await resp.json()
      salvarSessao(data)
      navigate("/inventario")
    } catch {
      setErro("Falha na conexão.")
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm p-8">
        <h1 className="mb-6 font-display text-2xl font-bold">Entrar no EduStock</h1>
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-semibold">Usuário</span>
          <input
            className="field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-semibold">Senha</span>
          <input
            type="password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {erro && <p className="mb-4 text-sm text-out">{erro}</p>}
        <button type="submit" disabled={carregando} className="btn w-full">
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  )
}
