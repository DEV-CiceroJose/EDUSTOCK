import { Navigate, Outlet } from "react-router-dom"
import { podeVerRede } from "../lib/auth"

export default function RequireRede() {
  return podeVerRede() ? <Outlet /> : <Navigate to="/inventario" replace />
}
