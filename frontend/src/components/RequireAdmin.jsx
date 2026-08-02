import { Navigate, Outlet } from "react-router-dom"
import { ehAdmin } from "../lib/auth"

export default function RequireAdmin() {
  if (!ehAdmin()) {
    return <Navigate to="/inventario" replace />
  }
  return <Outlet />
}
