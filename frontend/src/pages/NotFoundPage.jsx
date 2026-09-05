import { Link } from "react-router-dom"
import { estaAutenticado } from "../lib/auth"

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-6">
      <div className="card max-w-md p-8 text-center">
        <h1 className="font-display text-2xl font-bold">Página não encontrada</h1>
        <p className="my-4 text-ink-soft">Este endereço não existe ou foi alterado.</p>
        <Link className="btn btn-brand" to={estaAutenticado() ? "/app" : "/login"}>Voltar ao sistema</Link>
      </div>
    </main>
  )
}
