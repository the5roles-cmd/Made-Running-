// Route guard: redirect to /login when unauthenticated.
// While the session resolves, show a quiet branded splash.
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { loginHref } from '../lib/authNext'
import AuthSplash from './AuthSplash'

export default function RequireAuth({ children }) {
  const { user, loading, supabaseConfigured } = useAuth()
  const location = useLocation()

  // No backend configured yet — let the app through so the in-app
  // <SetupNotice> can explain how to connect Supabase.
  if (!supabaseConfigured) return children

  if (loading) return <AuthSplash />

  // Was state={{ from: location }}, which nothing ever read — so being bounced
  // off /app/sessions and then signing in landed you on the dashboard rather
  // than the page you actually asked for. ?next= is the same mechanism the
  // landing page's doors use, so there is one path to maintain, and unlike
  // router state it survives the full page reload of a cold deep link.
  if (!user) {
    return <Navigate to={loginHref(location.pathname + location.search)} replace />
  }
  return children
}
