import { useState } from 'react'
import { Form, Input, Button, message, Row, Col, Space, Alert } from 'antd'
import { SaveOutlined, CloseOutlined } from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'
import { apiPost } from '../../api'
import { useBranchAuth } from '../../auth'
import {
  buildSaudiPhone,
  parseApiErrorMessage,
  saudiPhoneFormRules,
} from '../../utils/phone'

interface CreateStaffProps {
  onSuccess: () => void
  onCancel: () => void
}

export default function CreateStaff({ onSuccess, onCancel }: CreateStaffProps) {
  const { t } = useTranslation()
  const { me } = useBranchAuth()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (values: any) => {
    if (!me?.branchId) return
    
    setLoading(true)
    setFormError(null)
    try {
      const staffData = {
        name: values.name,
        email: values.email,
        phone: buildSaudiPhone(values.phone),
        password: values.password,
        roles: ['staff'],
        branchId: me.branchId,
      } as const

      await apiPost('/users/staff', staffData)
      message.success(t('staff.created') || 'Staff member created successfully')
      onSuccess()
    } catch (error: any) {
      const errorMessage = parseApiErrorMessage(error, t)
      setFormError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      className="custom-form"
    >
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

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('staff.name') || 'Name'}
            name="name"
            rules={[{ required: true, message: t('staff.name_required') || 'Please enter name' }]}
          >
            <Input placeholder={t('staff.name_ph') || 'Enter staff name'} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('staff.email') || 'Email'}
            name="email"
            rules={[
              { required: true, message: t('staff.email_required') || 'Please enter email' },
              { type: 'email', message: t('staff.email_valid') || 'Please enter a valid email' }
            ]}
          >
            <Input type="email" placeholder={t('staff.email_ph') || 'Enter email address'} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('staff.phone') || 'Phone'}
            name="phone"
            rules={saudiPhoneFormRules(t, true)}
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
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('staff.password') || 'Password'}
            name="password"
            rules={[
              { required: true, message: t('staff.password_required') || 'Please enter password' },
              { min: 6, message: t('staff.password_min') || 'Password must be at least 6 characters' }
            ]}
          >
            <Input.Password placeholder={t('staff.password_ph') || 'Enter password'} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Form.Item
            label={t('staff.notes') || 'Notes (Optional)'}
            name="notes"
          >
            <Input.TextArea 
              rows={3} 
              placeholder={t('staff.notes_ph') || 'Enter any additional notes about this staff member'} 
            />
          </Form.Item>
        </Col>
      </Row>

      <div style={{ textAlign: 'right', marginTop: '24px' }}>
        <Space>
          <Button onClick={onCancel} icon={<CloseOutlined />}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
            icon={<SaveOutlined />}
            className="btn-primary"
          >
            {t('staff.create') || 'Create Staff'}
          </Button>
        </Space>
      </div>
    </Form>
  )
}
