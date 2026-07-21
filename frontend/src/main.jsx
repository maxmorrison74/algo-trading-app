import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './landing.css'
import OmniApp from './OmniApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OmniApp />
  </StrictMode>,
)
