import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import "./index.css"
import MainLayout from "./layouts/MainLayout"
import InventarioPage from "./pages/InventarioPage"
import MovimentacoesPage from "./pages/MovimentacoesPage"
import AlertasPage from "./pages/AlertasPage"
import FornecedoresPage from "./pages/FornecedoresPage"
import RelatoriosPage from "./pages/RelatoriosPage"
import MerendaPage from "./pages/MerendaPage"
import PerfilPage from "./pages/PerfilPage"
import ConfiguracoesPage from "./pages/ConfiguracoesPage"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route index element={<Navigate to="/inventario" replace />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route path="movimentacoes" element={<MovimentacoesPage />} />
          <Route path="alertas" element={<AlertasPage />} />
          <Route path="fornecedores" element={<FornecedoresPage />} />
          <Route path="relatorios" element={<RelatoriosPage />} />
          <Route path="merenda" element={<MerendaPage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="configuracoes" element={<ConfiguracoesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
