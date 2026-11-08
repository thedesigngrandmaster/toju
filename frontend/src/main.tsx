import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { SyncProvider } from './context/SyncContext'
import { Toaster } from './components/ui/Toaster'
import { UpdatePrompt } from './components/ui/UpdatePrompt'
import { initNetworkState } from './lib/network'
import { initPwa, ensurePersistentStorage } from './lib/pwa'

initNetworkState()
void initPwa(() => undefined)
void ensurePersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SyncProvider>
          <App />
          <Toaster />
          <UpdatePrompt />
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
