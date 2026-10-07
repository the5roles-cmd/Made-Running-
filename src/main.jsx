import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './theme.css'
import './app.css'
import { applyTenant } from './lib/theme'
import { AuthProvider } from './auth/AuthProvider'
import DemoBanner from './components/DemoBanner'
import App from './App'

applyTenant() // set <html data-tenant> before first paint

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        {/* Outside <App> so no route, boundary or Suspense fallback can
            unmount it — the warning has to outlive anything that goes wrong
            inside the app. Renders null in a normal build. */}
        <DemoBanner />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
