import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { ToastProvider } from "./components/Toast"
import DashboardPage from "./pages/DashboardPage"

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ToastProvider>
      <DashboardPage />
    </ToastProvider>
  </StrictMode>
)
