import { useEffect, useState } from "react"
import { Navigate, Outlet } from "react-router-dom"
import { estaAutenticado } from "../lib/auth"
import { SESSION_EXPIRED_EVENT } from "../lib/authenticatedFetch"

export default function RequireAuth() {
  const [sessaoExpirada, setSessaoExpirada] = useState(false)
  useEffect(() => {
    const expirar = () => setSessaoExpirada(true)
    window.addEventListener(SESSION_EXPIRED_EVENT, expirar)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expirar)
  }, [])
  if (sessaoExpirada || !estaAutenticado()) {
    return <Navigate to="/login" replace state={sessaoExpirada
      ? { message: "Sua sessão expirou. Entre novamente." }
      : null} />
  }
  return <Outlet />
}
