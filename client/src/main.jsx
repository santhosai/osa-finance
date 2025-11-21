import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import eruda from 'eruda'

// Initialize mobile debugger (Eruda) - shows console on mobile devices
// This will add a floating button on the page to open the console
if (typeof window !== 'undefined') {
  eruda.init();
  console.log('Mobile debugger (Eruda) initialized - tap the green icon to open console');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
