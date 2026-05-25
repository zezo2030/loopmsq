import { useState } from 'react'
import { Form, Input, Button, message, Alert } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'
import { apiPost } from '../../shared/api'
import { useAuth } from '../../shared/auth'
import {
  buildSaudiPhone,
  parseApiErrorMessage,
  saudiPhoneFormRules,
} from '../../shared/phone'

interface Props {
  onSuccess: () => void
  onCancel: () => void
}

export default function CreateStaff({ onSuccess, onCancel }: Props) {
  const { t } = useTranslation()
  const { me } = useAuth()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (values: any) => {
    setLoading(true)
    setFormError(null)
    try {
      await apiPost('/users/staff', { 
        name: values.name,
        email: values.email,
        password: values.password,
        phone: values.phone ? buildSaudiPhone(values.phone) : undefined,
        roles: ['staff'],
        branchId: me?.branchId,
      })
      message.success(t('staff.created') || 'Staff created successfully')
      onSuccess()
    } catch (e) {
      const errorMessage = parseApiErrorMessage(e, t)
      setFormError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} className="custom-form">
      {formError && (
        <Alert
          type="error"
          message={formError}
          showIcon
          closable
          onClose={() => setFormError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form.Item label={t('staff.name') || 'Name'} name="name" rules={[{ required: true, message: t('staff.name_required') }]}> 
        <Input placeholder={t('users.enter_full_name') || 'John Doe'} />
      </Form.Item>
      <Form.Item
        label={t('staff.email') || 'Email'}
        name="email"
        rules={[
          { required: true, message: t('staff.email_required') },
          { type: 'email', message: t('staff.email_valid') },
        ]}
      > 
        <Input placeholder={t('users.enter_email') || 'john@example.com'} />
      </Form.Item>
      <Form.Item
        label={t('staff.phone') || 'Phone'}
        name="phone"
        rules={saudiPhoneFormRules(t, false)}
      >
        <Input
          addonBefore="+966"
          maxLength={9}
          inputMode="numeric"
          placeholder={t('staff.phone_ph') || '501234567'}
          onChange={(event) => {
            const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 9)
            if (digitsOnly !== event.target.value) {
              form.setFieldValue('phone', digitsOnly)
            }
          }}
        />
      </Form.Item>
      <Form.Item label={t('staff.password') || 'Password'} name="password" rules={[{ required: true, message: t('staff.password_required') }, { min: 6, message: t('staff.password_min') }]}> 
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
