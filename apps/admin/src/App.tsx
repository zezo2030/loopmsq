import { useAdminAuth } from './auth'
import { Outlet, Navigate } from 'react-router-dom'
import { Spin, Result, Button } from 'antd'
import { Component, type ReactNode } from 'react'
import './App.css'

function App() {
  const { status } = useAdminAuth()

  if (status === 'loading') {
    return (
      <div className="app-loading">
        <Spin size="large" tip="Loading application..." />
      </div>
    )
  }

  if (status === 'unauthorized') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default App

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="app-unauthorized">
          <Result
            status="500"
            title="Something went wrong"
            subTitle="An unexpected error occurred. Please try again."
            extra={<Button type="primary" onClick={() => window.location.reload()}>Reload</Button>}
          />
        </div>
      )
    }
    return this.props.children as any
  }
}

export { ErrorBoundary }
