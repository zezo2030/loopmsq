import { useState } from 'react'
import { Form, Input, Button, message } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'
import { apiPost } from '../../shared/api'
import { useAuth } from '../../shared/auth'

interface Props {
  onSuccess: () => void
  onCancel: () => void
}

export default function CreateStaff({ onSuccess, onCancel }: Props) {
  const { t } = useTranslation()
  const { me } = useAuth()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      // Include branchId in the request for proper authorization
      await apiPost('/users/staff', { 
        ...values, 
        roles: ['staff'],
        branchId: me?.branchId 
      })
      message.success(t('staff.created') || 'Staff created successfully')
      onSuccess()
    } catch (e) {
      message.error(t('staff.create_failed') || 'Failed to create staff')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} className="custom-form">
      <Form.Item label={t('staff.name') || 'Name'} name="name" rules={[{ required: true }]}> 
        <Input placeholder={t('users.enter_full_name') || 'John Doe'} />
      </Form.Item>
      <Form.Item label={t('staff.email') || 'Email'} name="email" rules={[{ required: true, type: 'email' }]}> 
        <Input placeholder={t('users.enter_email') || 'john@example.com'} />
      </Form.Item>
      <Form.Item label={t('staff.password') || 'Password'} name="password" rules={[{ required: true }]}> 
        <Input.Password placeholder="Strong password" />
      </Form.Item>
      <div style={{ textAlign: 'right' }}>
        <Button onClick={onCancel} style={{ marginRight: 8 }}>{t('common.cancel') || 'Cancel'}</Button>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={loading} className="btn-primary">
          {t('common.create') || 'Create'}
        </Button>
      </div>
    </Form>
  )
}


