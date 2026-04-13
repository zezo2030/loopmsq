import { useState } from 'react'
import { Button, Form, Input, message, Space, Row, Col } from 'antd'
import { UserAddOutlined, SaveOutlined } from '@ant-design/icons'
import { apiPost } from '../../api'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import '../../theme.css'

export default function CreateUser() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  async function onFinish(values: any) {
    setLoading(true)
    try {
      await apiPost('/users', {
        phone: values.phone,
        name: values.name,
        email: values.email || undefined,
        password: values.password,
        language: values.language || 'ar',
      })
      message.success(t('users.user_created') || 'User created successfully!')
      form.resetFields()
      navigate('/admin/clients')
    } catch (e: any) {
      message.error(e?.message || t('users.user_create_failed') || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">
              <UserAddOutlined style={{ marginRight: '12px' }} />
              {t('page.create_user') || 'Create User'}
            </h1>
            <p className="page-subtitle">{t('users.create_user_subtitle') || 'Add a new customer to the system'}</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          <div className="custom-form">
            <Form 
              form={form}
              layout="vertical" 
              onFinish={onFinish}
              initialValues={{ language: 'ar' }}
            >
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item 
                    label={t('users.full_name') || 'Full Name'} 
                    name="name" 
                    rules={[{ required: true, message: t('users.enter_full_name') || 'Please enter full name' }]}
                  >
                    <Input placeholder={t('users.enter_full_name') || 'Enter user\'s full name'} size="large" />
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={12}>
                  <Form.Item 
                    label={t('users.phone_number') || 'Phone Number'} 
                    name="phone"
                    rules={[{ required: true, message: t('users.enter_phone') || 'Please enter phone number' }]}
                  >
                    <Input placeholder="+966 50 123 4567" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item 
                    label={t('users.email_address') || 'Email Address'} 
                    name="email" 
                    rules={[
                      { type: 'email', message: t('users.enter_valid_email') || 'Please enter a valid email' }
                    ]}
                  >
                    <Input type="email" placeholder="user@example.com" size="large" />
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={12}>
                  <Form.Item 
                    label={t('users.password') || 'Password'} 
                    name="password" 
                    rules={[
                      { required: true, message: t('users.enter_password') || 'Please enter password' },
                      { min: 6, message: t('users.password_min_length') || 'Password must be at least 6 characters' }
                    ]}
                  >
                    <Input.Password placeholder={t('users.create_password') || 'Create a secure password'} size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item label={t('users.language') || 'Language'} name="language">
                    <Input 
                      size="large"
                      placeholder={t('users.select_language') || 'Select language'}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginTop: '32px', textAlign: 'center' }}>
                <Space size="middle">
                  <Button size="large" onClick={() => form.resetFields()}>
                    {t('common.reset_form') || 'Reset Form'}
                  </Button>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    size="large"
                    icon={<SaveOutlined />}
                    className="btn-primary"
                  >
                    {t('users.create_user') || 'Create User'}
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        </div>
      </div>
    </div>
  )
}