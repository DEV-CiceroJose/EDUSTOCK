import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { salvarSessao, sessaoFoiExpirada } from "../lib/auth"
import { Icon } from "../lib/icons"

async function mensagemDeErro(resp) {
  let detalhe = ""
  try {
    const data = await resp.json()
    detalhe = typeof data?.detail === "string" ? data.detail : ""
  } catch {
    // Algumas respostas de infraestrutura não possuem corpo JSON.
  }

  if (resp.status === 401) return "Usuário ou senha inválidos."
  if (resp.status === 429) {
    return detalhe || "Muitas tentativas. Aguarde alguns minutos e tente novamente."
  }
  if (resp.status >= 500) {
    return "O servidor encontrou um erro. Aguarde um instante e tente novamente."
  }
  return detalhe || "Não foi possível entrar. Tente novamente."
}

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const aviso = sessaoFoiExpirada() ? "Sua sessão expirou. Entre novamente." : location.state?.message

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
        setErro(await mensagemDeErro(resp))
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
        {aviso && <p role="status" className="mb-4 text-sm text-ink-soft">{aviso}</p>}
        <label className="mb-1 block text-sm font-semibold" htmlFor="login-username">
          Usuário
        </label>
        <div className="mb-4">
          <input
            id="login-username"
            className="field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="login-password">
          Senha
        </label>
        <div className="relative mb-4">
          <input
            id="login-password"
            type={mostrarSenha ? "text" : "password"}
            className="field pr-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted transition hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => setMostrarSenha((valor) => !valor)}
            aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={mostrarSenha}
            title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
          >
            {mostrarSenha ? Icon.eyeOff(20) : Icon.eye(20)}
          </button>
        </div>
        {erro && <p className="mb-4 text-sm text-out">{erro}</p>}
        <button type="submit" disabled={carregando} className="btn w-full">
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  )
}
