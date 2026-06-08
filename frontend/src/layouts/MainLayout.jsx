import { useState } from "react"
import { Outlet } from "react-router-dom"
import { ToastProvider } from "../components/ui/Toast"
import Sidebar from "./Sidebar"
import Header from "./Header"

export default function MainLayout() {
  const [search, setSearch] = useState("")
  
  const handleAddItem = () => {
    // To be implemented by pages via context or events
  }
  
  const handleReport = () => {
    // To be implemented by pages via context or events
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
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
