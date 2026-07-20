import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import "./index.css"
import MainLayout from "./layouts/MainLayout"
import RequireAuth from "./components/RequireAuth"
import RequireModule from "./components/RequireModule"
import LoginPage from "./pages/LoginPage"
import InventarioPage from "./pages/InventarioPage"
import MovimentacoesPage from "./pages/MovimentacoesPage"
import AlertasPage from "./pages/AlertasPage"
import FornecedoresPage from "./pages/FornecedoresPage"
import RelatoriosPage from "./pages/RelatoriosPage"
import MerendaPage from "./pages/MerendaPage"
import PerfilPage from "./pages/PerfilPage"
import ConfiguracoesPage from "./pages/ConfiguracoesPage"
import ModuloIndisponivelPage from "./pages/ModuloIndisponivelPage"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<MainLayout />}>
            <Route index element={<Navigate to="/inventario" replace />} />

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
            <Route path="modulo-indisponivel" element={<ModuloIndisponivelPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
