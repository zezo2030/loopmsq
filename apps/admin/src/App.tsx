import { useAdminAuth } from './auth'
import { Outlet, useNavigate } from 'react-router-dom'
import { Spin, Result, Button } from 'antd'
import './App.css'

function App() {
  const { status } = useAdminAuth()
  const navigate = useNavigate()

  if (status === 'loading') {
    return (
      <div className="app-loading">
        <Spin size="large" tip="Loading application..." />
      </div>
    )
  }

  if (status === 'unauthorized') {
    return (
      <div className="app-unauthorized">
        <Result
          status="403"
          title="Access Denied"
          subTitle="Sorry, you are not authorized to access this page. Please log in with an Admin or Branch Manager account."
          extra={<Button type="primary" onClick={() => navigate('/login')}>Go to Login</Button>}
        />
      </div>
    )
  }

  return <Outlet />
}

export default App
