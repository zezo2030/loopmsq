import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Card, Form, Input, Switch, message } from 'antd'
import { apiGet, apiPut } from '../../api'

type User = {
  id: string
  name?: string
  email?: string
  phone?: string
  roles?: string[]
  language?: string
  isActive?: boolean
}

export default function UserDetail() {
  const { id } = useParams()
  const [form] = Form.useForm<User>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await apiGet<User>(`/users/${id}`)
        if (!mounted) return
        form.setFieldsValue({
          name: data.name,
          email: data.email,
          language: data.language || 'ar',
          isActive: data.isActive,
        })
      } catch (e: any) {
        message.error(e?.message || 'Failed to load user')
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id])

  async function onSave(values: User) {
    setSaving(true)
    try {
      await apiPut(`/users/${id}`, {
        name: values.name,
        email: values.email,
        language: values.language,
        isActive: values.isActive,
      })
      message.success('User updated')
    } catch (e: any) {
      message.error(e?.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="User Details" loading={loading}>
      <Form form={form} layout="vertical" onFinish={onSave}>
        <Form.Item label="Name" name="name">
          <Input />
        </Form.Item>
        <Form.Item label="Email" name="email">
          <Input type="email" />
        </Form.Item>
        <Form.Item label="Language" name="language">
          <Input />
        </Form.Item>
        <Form.Item label="Active" name="isActive" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>Save</Button>
      </Form>
    </Card>
  )
}


