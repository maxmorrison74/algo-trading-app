import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './landing.css'
import './app-shell-critical.css'
import OmniApp from './OmniApp.jsx'

try {
  const authToken = window?.localStorage?.getItem('omni_auth_token')
  const authTime = window?.localStorage?.getItem('omni_auth_time')
  const demoMode = window?.localStorage?.getItem('omni_demo_mode') === '1'
  const authValid = Boolean(
    authToken &&
    authTime &&
    Number.isFinite(Number(authTime)) &&
    Date.now() - Number(authTime) < 24 * 60 * 60 * 1000,
  )

  if (authValid || demoMode) {
    import('./app-shell.css')
  }
} catch {}

try {
  const scheduleDeferredLanding = () => import('./landing-deferred.css')
  if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
    window.requestAnimationFrame(() => {
      window.setTimeout(scheduleDeferredLanding, 0)
    })
  } else {
    setTimeout(scheduleDeferredLanding, 0)
  }
} catch {}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OmniApp />
  </StrictMode>,
)
