import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import eruda from 'eruda'

// Initialize mobile debugger (Eruda) - ONLY IN DEVELOPMENT
// This will add a floating button on the page to open the console
// In production, this will not run - no debug button will appear
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  eruda.init();
  console.log('Mobile debugger (Eruda) initialized - tap the green icon to open console');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
