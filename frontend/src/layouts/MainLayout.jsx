import { useEffect, useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { ToastProvider } from "../components/ui/Toast"
import Sidebar from "./Sidebar"
import Header from "./Header"
import { useAppConfig } from "../hooks/useAppConfig"
import { podeGerenciarCadastros } from "../lib/auth"

export default function MainLayout() {
  const [search, setSearch] = useState("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const config = useAppConfig()
  const canManage = podeGerenciarCadastros()
  const navigate = useNavigate()

  useEffect(() => {
    if (!mobileMenuOpen) return undefined
    const fecharComEscape = (event) => {
      if (event.key === "Escape") setMobileMenuOpen(false)
    }
    document.addEventListener("keydown", fecharComEscape)
    return () => document.removeEventListener("keydown", fecharComEscape)
  }, [mobileMenuOpen])
  
  const handleAddItem = () => {
    navigate('/inventario', { state: { openAdd: true } })
  }
  
  const handleReport = () => {
    navigate('/relatorios')
  }

  return (
    <ToastProvider>
      <div className="flex h-screen" data-card-density={config.cardDensity}>
        <Sidebar />
        {mobileMenuOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-brand-700/35 backdrop-blur-[2px] lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fechar menu"
            />
            <Sidebar
              mobile
              onNavigate={() => setMobileMenuOpen(false)}
              onClose={() => setMobileMenuOpen(false)}
            />
          </>
        )}
        <div className="flex flex-1 flex-col">
          <Header 
            search={search} 
            setSearch={setSearch}
            onAddItem={handleAddItem}
            onReport={handleReport}
            onMenu={() => setMobileMenuOpen((aberto) => !aberto)}
            menuOpen={mobileMenuOpen}
            canManage={canManage}
          />
          <main className="flex-1 overflow-auto overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
