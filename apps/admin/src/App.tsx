import { useEffect, useState } from 'react'
import { useAdminAuth } from './auth'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [apiHealth, setApiHealth] = useState<string>('checking...')
  const { status } = useAdminAuth()

  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE || (window as any).NEXT_PUBLIC_API_BASE || 'http://localhost:3000/api/v1';
    fetch(`${base}/health`)
      .then((r) => r.ok ? r.text() : Promise.reject(r.statusText))
      .then((t) => setApiHealth(t))
      .catch(() => setApiHealth('unreachable'))
  }, [])

  if (status === 'loading') {
    return (
      <>
        <p>Loading...</p>
      </>
    )
  }

  if (status === 'unauthorized') {
    return (
      <>
        <p>Unauthorized. Please login with an admin or branch manager account.</p>
      </>
    )
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <div className="card">
        <p>API health: {apiHealth}</p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
