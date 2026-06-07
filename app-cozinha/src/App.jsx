import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PinLogin from './PinLogin.jsx'
import ProducaoView from './ProducaoView.jsx'
import { isLoggedIn } from './api.js'

function Protegido({ children }) {
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
