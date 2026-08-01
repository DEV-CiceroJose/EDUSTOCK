import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import PinLogin from './PinLogin.jsx'
import ContagemView from './ContagemView.jsx'
import { getSessao, logout } from './api.js'
import { useIdleLogout } from './useIdleLogout.js'

/**
 * Guarda de rota — redireciona para /login se não há sessão ativa.
 */
function Protegido({ children }) {
  const navigate = useNavigate()
  useIdleLogout(() => {
    void logout()
    navigate('/login', { replace: true })
  })

  return getSessao() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PinLogin />} />
        <Route
          path="/registrar"
          element={
            <Protegido>
              <ContagemView />
            </Protegido>
          }
        />
        {/* Qualquer outra rota vai para login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
