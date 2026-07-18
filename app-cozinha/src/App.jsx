import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import PinLogin from './PinLogin.jsx'
import ProducaoView from './ProducaoView.jsx'
import { isLoggedIn, logout } from './api.js'
import { useIdleLogout } from './useIdleLogout.js'

function Protegido({ children }) {
  const navigate = useNavigate()
  useIdleLogout(() => {
    logout()
    navigate('/login', { replace: true })
  })

  return isLoggedIn() ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PinLogin />} />
        <Route
          path="/producao"
          element={
            <Protegido>
              <ProducaoView />
            </Protegido>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
