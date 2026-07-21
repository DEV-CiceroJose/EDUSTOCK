import { useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { ToastProvider } from "../components/ui/Toast"
import Sidebar from "./Sidebar"
import Header from "./Header"

export default function MainLayout() {
  const [search, setSearch] = useState("")
  const navigate = useNavigate()
  
  const handleAddItem = () => {
    navigate('/inventario', { state: { openAdd: true } })
  }
  
  const handleReport = () => {
    navigate('/relatorios')
  }

  return (
    <ToastProvider>
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <Header 
            search={search} 
            setSearch={setSearch}
            onAddItem={handleAddItem}
            onReport={handleReport}
          />
          <main className="flex-1 overflow-auto overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
