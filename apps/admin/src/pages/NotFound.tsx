import { Result, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import '../theme.css'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="page-container">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: 'calc(100vh - 200px)' 
      }}>
        <Result
          status="404"
          title="404"
          subTitle="عذراً، الصفحة المطلوبة غير موجودة."
          extra={
            <Button type="primary" onClick={() => navigate('/admin')}>
              العودة إلى لوحة التحكم
            </Button>
          }
        />
      </div>
    </div>
  )
}

