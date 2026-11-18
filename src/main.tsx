import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App'
import { bootstrap } from './bootstrap'
import { prepareBillStore } from './hooks/useBillSplit'

void bootstrap(
  createRoot(document.getElementById('root')!),
  prepareBillStore,
  <StrictMode>
    <App />
  </StrictMode>,
)
