import { Navigate, Outlet } from "react-router-dom"
import { getModulosAtivos } from "../lib/auth"

export default function RequireModule({ slug }) {
  const modulos = getModulosAtivos()
  if (!modulos.includes(slug)) {
    return <Navigate to="/modulo-indisponivel" replace />
  }
  return <Outlet />
}
