import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('access_token') || '')
  const [loading, setLoading] = useState(true)

  const saveSession = (nextToken, nextUser) => {
    localStorage.setItem('access_token', nextToken)
    setToken(nextToken)
    setUser(nextUser)
  }

  const clearSession = () => {
    localStorage.removeItem('access_token')
    setToken('')
    setUser(null)
  }

  const refreshMe = async () => {
    const t = localStorage.getItem('access_token')
    if (!t) { setLoading(false); return }
    try {
      const me = await api.getMe()
      setUser(me.user)
      setToken(t)
    } catch {
      clearSession()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refreshMe() }, [])

  const value = useMemo(() => ({
    user, token, loading,
    login: async (email, password) => { const res = await api.login({ email, password }); saveSession(res.access_token, res.user); return res },
    register: async (name, email, password) => { const res = await api.register({ name, email, password }); saveSession(res.access_token, res.user); return res },
    logout: async () => { try { await api.logout() } finally { clearSession() } },
    refreshMe,
  }), [user, token, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
