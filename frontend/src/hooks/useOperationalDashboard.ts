import { useCallback, useEffect, useState } from "react"
import { dashboardApi } from "../api"
import type { DashboardOperacional } from "../api/types"

export function useOperationalDashboard(data?: string) {
  const [dashboard, setDashboard] = useState<DashboardOperacional | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [revision, setRevision] = useState(0)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    setRevision((current) => current + 1)
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    dashboardApi.get(data)
      .then((nextDashboard) => {
        if (!active) return
        setDashboard(nextDashboard)
      })
      .catch((cause) => {
        if (!active) return
        setError(cause)
        setDashboard(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [data, revision])

  return { data: dashboard, loading, error, reload }
}
