import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (e) {
  document.getElementById('root')!.innerHTML = `
    <div style="padding:20px;text-align:center;font-family:sans-serif">
      <h2>SnapSort 로딩 실패</h2>
      <p style="color:red">${e instanceof Error ? e.message : String(e)}</p>
      <button onclick="indexedDB.deleteDatabase('sns-capture-db');location.reload()"
        style="margin-top:16px;padding:12px 24px;background:#3B82F6;color:white;border:none;border-radius:8px;font-size:16px">
        초기화 후 새로고침
      </button>
    </div>
  `
}
