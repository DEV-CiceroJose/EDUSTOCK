import { BrowserRouter, Routes, Route, Navigate, useNavigate, NavLink } from 'react-router-dom'
import EntregasView from './EntregasView.jsx'
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
    navigate('/login', {
      replace: true,
      state: { message: 'Sessão encerrada por inatividade. Digite o PIN novamente.' },
    })
  })

  return getSessao() ? <><nav aria-label="Serviços da turma" className="mx-auto flex max-w-xl gap-3 px-4 pt-4"><NavLink className="rounded-lg border border-line px-4 py-2" to="/registrar">Presença</NavLink><NavLink className="rounded-lg border border-line px-4 py-2" to="/entregas">Entregas</NavLink></nav>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PinLogin />} />
        <Route path="/entregas" element={<Protegido><EntregasView /></Protegido>} />
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
