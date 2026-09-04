import { Navigate, Outlet, useOutletContext } from "react-router-dom"
import { getModulosAtivos } from "../lib/auth"

export default function RequireModule({ slug }) {
  const layout = useOutletContext()
  const modulos = getModulosAtivos()
  if (!modulos.includes(slug)) {
    return <Navigate to="/modulo-indisponivel" replace />
  }
  return <Outlet context={layout} />
}
