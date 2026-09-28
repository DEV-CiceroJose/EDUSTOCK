import { BrowserRouter, Routes, Route, Navigate, useNavigate, NavLink } from 'react-router-dom'
import PinLogin from './PinLogin.jsx'
import ProducaoView from './ProducaoView.jsx'
import ReceitasView from './ReceitasView.jsx'
import CardapioView from './CardapioView.jsx'
import { isLoggedIn, logout } from './api.js'
import { useIdleLogout } from './useIdleLogout.js'

function Protegido({ children }) {
  const navigate = useNavigate()
  useIdleLogout(() => {
    void logout()
    navigate('/login', {
      replace: true,
      state: { message: 'Sessão encerrada por inatividade. Digite o PIN novamente.' },
    })
  })

  const classeLink = ({ isActive }) => `whitespace-nowrap rounded-xl border px-4 py-2 font-semibold ${isActive ? 'border-brand bg-brand text-white' : 'border-line bg-white'}`
  return isLoggedIn() ? <>
    <nav aria-label="Serviços da cozinha" className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 pt-4">
      <NavLink className={classeLink} to="/producao">Produção</NavLink>
      <NavLink className={classeLink} to="/receitas">Receitas</NavLink>
      <NavLink className={classeLink} to="/cardapio">Cardápio</NavLink>
    </nav>
    {children}
  </> : <Navigate to="/login" replace />
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
        <Route path="/receitas" element={<Protegido><ReceitasView /></Protegido>} />
        <Route path="/cardapio" element={<Protegido><CardapioView /></Protegido>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
