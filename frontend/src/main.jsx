// React 애플리케이션의 진입점으로, 최상위 App 컴포넌트를 root DOM에 마운트하는 파일

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
