import { useNavigate } from "react-router-dom"
import { encerrarSessao } from "../lib/auth"
import { Icon } from "../lib/icons"

export default function LogoutButton({ className = "btn btn-ghost", labelClassName = "" }) {
  const navigate = useNavigate()

  function sair() {
    void encerrarSessao()
    navigate("/login", { replace: true })
  }

  return (
    <button type="button" onClick={sair} className={className}
      aria-label="Sair da conta" title="Sair da conta">
      <span className="shrink-0" aria-hidden="true">{Icon.logout(21)}</span>
      <span className={labelClassName}>Sair</span>
    </button>
  )
}
