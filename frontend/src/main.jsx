import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import OmniApp from './OmniApp.jsx'

const DAY_MS = 24 * 60 * 60 * 1000

const detectAuthenticatedShell = () => {
  try {
    const authToken = window?.localStorage?.getItem('omni_auth_token')
    const authTime = window?.localStorage?.getItem('omni_auth_time')
    const demoMode = window?.localStorage?.getItem('omni_demo_mode') === '1'
    const authValid = Boolean(
      authToken &&
      authTime &&
      Number.isFinite(Number(authTime)) &&
      Date.now() - Number(authTime) < DAY_MS,
    )
    return authValid || demoMode
  } catch {
    return false
  }
}

const renderApp = () => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <OmniApp />
    </StrictMode>,
  )
}

const scheduleDeferredLandingStyles = () => {
  try {
    const loadDeferred = () => import('./landing-deferred.css')
    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      window.requestAnimationFrame(() => {
        window.setTimeout(loadDeferred, 0)
      })
    } else {
      setTimeout(loadDeferred, 0)
    }
  } catch {}
}

const bootAuthenticatedShell = async () => {
  await Promise.all([
    import('./app-shell-critical.css'),
    import('./app-shell.css'),
  ])
  renderApp()
}

const bootLanding = async () => {
  await import('./landing.css')
  renderApp()
  scheduleDeferredLandingStyles()
}

if (detectAuthenticatedShell()) {
  await bootAuthenticatedShell()
} else {
  await bootLanding()
}
