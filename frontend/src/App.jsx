import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import RequireAuth from "./components/RequireAuth"
import RequireAdmin from "./components/RequireAdmin"
import RequireModule from "./components/RequireModule"
import RequireRede from "./components/RequireRede"
import LandingPage from "./pages/LandingPage"

const MainLayout = lazy(() => import("./layouts/MainLayout"))
const LoginPage = lazy(() => import("./pages/LoginPage"))
const InventarioPage = lazy(() => import("./pages/InventarioPage"))
const MovimentacoesPage = lazy(() => import("./pages/MovimentacoesPage"))
const AlertasPage = lazy(() => import("./pages/AlertasPage"))
const FornecedoresPage = lazy(() => import("./pages/FornecedoresPage"))
const RelatoriosPage = lazy(() => import("./pages/RelatoriosPage"))
const MerendaPage = lazy(() => import("./pages/MerendaPage"))
const PerfilPage = lazy(() => import("./pages/PerfilPage"))
const ConfiguracoesPage = lazy(() => import("./pages/ConfiguracoesPage"))
const ModuloIndisponivelPage = lazy(() => import("./pages/ModuloIndisponivelPage"))
const AdminModulosPage = lazy(() => import("./pages/AdminModulosPage"))
const AdminUsuariosPage = lazy(() => import("./pages/AdminUsuariosPage"))
const RedeMunicipalPage = lazy(() => import("./pages/RedeMunicipalPage"))
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"))

export default function App() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center text-ink-faint">Carregando…</div>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<NotFoundPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<MainLayout />}>
            <Route path="app" element={<Navigate to="/inventario" replace />} />

            <Route element={<RequireModule slug="inventario" />}>
              <Route path="inventario" element={<InventarioPage />} />
            </Route>
            <Route element={<RequireModule slug="movimentacoes" />}>
              <Route path="movimentacoes" element={<MovimentacoesPage />} />
            </Route>
            <Route element={<RequireModule slug="alertas" />}>
              <Route path="alertas" element={<AlertasPage />} />
            </Route>
            <Route element={<RequireModule slug="fornecedores" />}>
              <Route path="fornecedores" element={<FornecedoresPage />} />
            </Route>
            <Route element={<RequireModule slug="relatorios" />}>
              <Route path="relatorios" element={<RelatoriosPage />} />
            </Route>
            <Route element={<RequireModule slug="merenda" />}>
              <Route path="merenda" element={<MerendaPage />} />
            </Route>

            <Route path="perfil" element={<PerfilPage />} />
            <Route path="configuracoes" element={<ConfiguracoesPage />} />
            <Route element={<RequireRede />}>
              <Route path="rede" element={<RedeMunicipalPage />} />
            </Route>
            <Route element={<RequireAdmin />}>
              <Route path="admin/modulos" element={<AdminModulosPage />} />
              <Route path="admin/usuarios" element={<AdminUsuariosPage />} />
            </Route>
            <Route path="modulo-indisponivel" element={<ModuloIndisponivelPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
