import { BrowserRouter, Routes, Route, Navigate, useNavigate, NavLink } from 'react-router-dom'
import PinLogin from './PinLogin.jsx'
import ProducaoView from './ProducaoView.jsx'
import ReceitasView from './ReceitasView.jsx'
import CardapioView from './CardapioView.jsx'
import NutricaoView from './NutricaoView.jsx'
import { getSessao, isLoggedIn, logout } from './api.js'
import { useIdleLogout } from './useIdleLogout.js'

function Protegido({ children, perfis }) {
  const navigate = useNavigate()
  useIdleLogout(() => {
    void logout()
    navigate('/login', {
      replace: true,
      state: { message: 'Sessão encerrada por inatividade. Digite o PIN novamente.' },
    })
  })

  const sessao = getSessao()
  if (!isLoggedIn() || !sessao) return <Navigate to="/login" replace />
  if (perfis && !perfis.includes(sessao.perfil)) {
    return <Navigate to={sessao.perfil === 'NUTRICIONISTA' ? '/nutricao' : '/producao'} replace />
  }
  const classeLink = ({ isActive }) => `whitespace-nowrap rounded-xl border px-4 py-2 font-semibold ${isActive ? 'border-brand bg-brand text-white' : 'border-line bg-white'}`
  return <>
    <nav aria-label={sessao.perfil === 'NUTRICIONISTA' ? 'Serviços da nutrição' : 'Serviços da cozinha'} className="mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 pt-4">
      {sessao.perfil === 'NUTRICIONISTA'
        ? <NavLink className={classeLink} to="/nutricao">Porções por aluno</NavLink>
        : <><NavLink className={classeLink} to="/producao">Produção</NavLink><NavLink className={classeLink} to="/receitas">Receitas</NavLink><NavLink className={classeLink} to="/cardapio">Cardápio</NavLink></>}
    </nav>
    {children}
  </>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<PinLogin />} />
        <Route
          path="/producao"
          element={
            <Protegido perfis={['COZINHA']}>
              <ProducaoView />
            </Protegido>
          }
        />
        <Route path="/receitas" element={<Protegido perfis={['COZINHA']}><ReceitasView /></Protegido>} />
        <Route path="/cardapio" element={<Protegido perfis={['COZINHA']}><CardapioView /></Protegido>} />
        <Route path="/nutricao" element={<Protegido perfis={['NUTRICIONISTA']}><NutricaoView /></Protegido>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
