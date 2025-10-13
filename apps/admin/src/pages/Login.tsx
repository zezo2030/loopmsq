import { useState } from 'react'
import { Button, Card, Form, Input, Typography, message, Space } from 'antd'
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons'
import '../theme.css'

function getApiBase(): string {
  const base = (import.meta as any).env?.VITE_API_BASE || (window as any).NEXT_PUBLIC_API_BASE
  return (typeof base === 'string' && base) ? base : 'http://localhost:3000/api/v1'
}

export default function Login() {
  const [loading, setLoading] = useState(false)

  async function onFinish(values: { email: string; password: string }) {
    setLoading(true)
    try {
      const resp = await fetch(`${getApiBase()}/auth/staff/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!resp.ok) throw new Error('Invalid credentials')
      const data = await resp.json()
      localStorage.setItem('accessToken', data.accessToken)
      message.success('تم تسجيل الدخول بنجاح')
      window.location.href = '/'
    } catch (e: any) {
      message.error(e?.message || 'فشل تسجيل الدخول')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <Card 
        className="login-card"
        title={
          <Space direction="vertical" align="center" style={{ width: '100%' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🏢</div>
            <Typography.Title level={3} style={{ margin: 0, color: '#262626' }}>
              Admin Dashboard
            </Typography.Title>
            <Typography.Text type="secondary">
              Welcome back! Please sign in to continue
            </Typography.Text>
          </Space>
        }
        bordered={false}
      >
        <Form 
          layout="vertical" 
          onFinish={onFinish}
          className="custom-form"
          style={{ padding: '20px 0' }}
        >
          <Form.Item 
            label="Email Address" 
            name="email" 
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input 
              prefix={<UserOutlined />}
              type="email" 
              placeholder="admin@example.com"
              size="large"
            />
          </Form.Item>
          
          <Form.Item 
            label="Password" 
            name="password" 
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password 
              prefix={<LockOutlined />}
              placeholder="Enter your password"
              size="large"
            />
          </Form.Item>
          
          <Form.Item style={{ marginBottom: '12px' }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              size="large"
              icon={<LoginOutlined />}
              className="btn-primary"
              block
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>
        
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Typography.Paragraph 
            type="secondary" 
            style={{ margin: 0, fontSize: '12px' }}
          >
            🔒 Secure access for Admin and Branch Manager accounts only
          </Typography.Paragraph>
        </div>
      </Card>
    </div>
  )
}


