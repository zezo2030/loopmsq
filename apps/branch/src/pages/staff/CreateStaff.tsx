import { useState } from 'react'
import { Form, Input, Button, message, Row, Col, Space } from 'antd'
import { SaveOutlined, CloseOutlined } from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'
import { apiPost } from '../../api'
import { useBranchAuth } from '../../auth'

interface CreateStaffProps {
  onSuccess: () => void
  onCancel: () => void
}

export default function CreateStaff({ onSuccess, onCancel }: CreateStaffProps) {
  const { t } = useTranslation()
  const { me } = useBranchAuth()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: any) => {
    if (!me?.branchId) return
    
    setLoading(true)
    try {
      const staffData = {
        ...values,
        roles: ['staff'],
        branchId: me.branchId,
        isActive: true,
      }

      await apiPost('/users/staff', staffData)
      message.success(t('staff.created') || 'Staff member created successfully')
      onSuccess()
    } catch (error) {
      message.error(t('staff.create_failed') || 'Failed to create staff member')
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
      {/* Basic Information */}
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
            rules={[{ required: true, message: t('staff.phone_required') || 'Please enter phone number' }]}
          >
            <Input placeholder={t('staff.phone_ph') || 'Enter phone number'} />
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

      {/* Additional Information */}
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

      {/* Form Actions */}
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
