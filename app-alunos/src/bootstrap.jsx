import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

export function montarAplicativo(elemento) {
  createRoot(elemento).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
