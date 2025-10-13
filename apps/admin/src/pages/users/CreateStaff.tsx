import { useState } from 'react'
import { Button, Card, Form, Input, Select, message } from 'antd'
import { apiPost } from '../../api'

export default function CreateStaff() {
  const [loading, setLoading] = useState(false)

  async function onFinish(values: any) {
    setLoading(true)
    try {
      await apiPost('/users/staff', {
        email: values.email,
        name: values.name,
        password: values.password,
        roles: values.roles,
        phone: values.phone || undefined,
        language: values.language || 'ar',
        branchId: values.branchId || undefined,
      })
      message.success('Staff created')
    } catch (e: any) {
      message.error(e?.message || 'Create failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Create Staff">
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item label="Name" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
          <Input type="email" />
        </Form.Item>
        <Form.Item label="Password" name="password" rules={[{ required: true, min: 6 }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item label="Roles" name="roles" rules={[{ required: true }]}>
          <Select mode="multiple" options={[
            { label: 'staff', value: 'staff' },
            { label: 'user', value: 'user' },
          ]} />
        </Form.Item>
        <Form.Item label="Phone" name="phone">
          <Input />
        </Form.Item>
        <Form.Item label="Language" name="language" initialValue="ar">
          <Input />
        </Form.Item>
        <Form.Item label="Branch ID" name="branchId">
          <Input />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>Create</Button>
      </Form>
    </Card>
  )
}


