import { Navigate, Outlet } from "react-router-dom"
import { estaAutenticado } from "../lib/auth"

export default function RequireAuth() {
  if (!estaAutenticado()) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
