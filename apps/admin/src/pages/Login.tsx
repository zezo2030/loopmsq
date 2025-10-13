import { useState } from 'react'
import { Button, Card, Form, Input, Typography, message } from 'antd'

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
      message.success('Logged in successfully')
      window.location.href = '/'
    } catch (e: any) {
      message.error(e?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Card title="Admin Login" style={{ width: 360 }}>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item label="Email" name="email" rules={[{ required: true, message: 'Email is required' }]}>
            <Input type="email" placeholder="admin@example.com" />
          </Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true, message: 'Password is required' }]}>
            <Input.Password placeholder="••••••••" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Login
          </Button>
        </Form>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
          Only Admin or Branch Manager accounts are allowed.
        </Typography.Paragraph>
      </Card>
    </div>
  )
}


