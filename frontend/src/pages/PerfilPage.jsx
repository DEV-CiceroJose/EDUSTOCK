import { useNavigate } from "react-router-dom"

export default function PerfilPage() {
  const navigate = useNavigate()

  // Read environment variables with defaults
  const userName = import.meta.env.VITE_USER_NAME || "Usuário Dev"
  const userEmail = import.meta.env.VITE_USER_EMAIL || "dev@edustock.local"

  // Get first letter of name for avatar
  const avatarLetter = userName.charAt(0).toUpperCase()

  const handleLogout = () => {
    // Clear localStorage
    localStorage.clear()
    
    // Navigate to inventario
    navigate("/inventario")
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-8">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold leading-tight">Perfil</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-faint">
          Gerencie suas informações de perfil e sessão
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-6">
        {/* Avatar Section */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-surface text-2xl font-bold text-brand">
            {avatarLetter}
          </div>
          <div className="flex-1">
            <h3 className="font-display text-xl font-bold">{userName}</h3>
            <p className="text-sm text-ink-faint">{userEmail}</p>
          </div>
        </div>

        {/* Dev Mode Badge */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M6.701 2.25c.577-1 2.02-1 2.598 0l5.196 9a1.5 1.5 0 0 1-1.299 2.25H2.804a1.5 1.5 0 0 1-1.3-2.25l5.197-9ZM8 4a.75.75 0 0 1 .75.75v3a.75.75 0 1 1-1.5 0v-3A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clipRule="evenodd"
              />
            </svg>
            Modo Desenvolvimento
          </div>
        </div>

        {/* User Information (Read-only) */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-faint">
              Nome
            </label>
            <div className="rounded-lg border border-line bg-background px-4 py-3 text-ink">
              {userName}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink-faint">
              Email
            </label>
            <div className="rounded-lg border border-line bg-background px-4 py-3 text-ink">
              {userEmail}
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div className="flex justify-end border-t border-line pt-6">
          <button
            onClick={handleLogout}
            className="rounded-lg bg-danger px-4 py-2 font-medium text-white transition-colors hover:bg-danger/90"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
