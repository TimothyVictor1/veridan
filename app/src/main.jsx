import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import VeridianTwin from './veridian_twin_prototype.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <VeridianTwin />
  </StrictMode>,
)
