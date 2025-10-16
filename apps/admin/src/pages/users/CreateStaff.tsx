import { useState } from 'react'
import { Button, Form, Input, Select, message, Space, Row, Col } from 'antd'
import { UserAddOutlined, SaveOutlined } from '@ant-design/icons'
import { apiPost } from '../../api'
import { useTranslation } from 'react-i18next'
import '../../theme.css'

export default function CreateStaff() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

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
      message.success('Staff member created successfully!')
      form.resetFields()
    } catch (e: any) {
      message.error(e?.message || 'Failed to create staff member')
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
              Create Staff Member
            </h1>
            <p className="page-subtitle">Add a new staff member to your team</p>
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
              initialValues={{ language: 'ar', roles: ['staff'] }}
            >
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item 
                    label={t('users.full_name') || 'Full Name'} 
                    name="name" 
                    rules={[{ required: true, message: t('users.enter_full_name') || 'Please enter full name' }]}
                  >
                    <Input placeholder={t('users.enter_full_name') || 'Enter staff member\'s full name'} size="large" />
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={12}>
                  <Form.Item 
                    label={t('users.email_address') || 'Email Address'} 
                    name="email" 
                    rules={[
                      { required: true, message: t('users.enter_email') || 'Please enter email' },
                      { type: 'email', message: t('users.enter_valid_email') || 'Please enter a valid email' }
                    ]}
                  >
                    <Input type="email" placeholder="staff@company.com" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item 
                    label="Password" 
                    name="password" 
                    rules={[
                      { required: true, message: 'Please enter password' },
                      { min: 6, message: 'Password must be at least 6 characters' }
                    ]}
                  >
                    <Input.Password placeholder="Create a secure password" size="large" />
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={12}>
                  <Form.Item 
                    label={t('users.phone_number') || 'Phone Number'} 
                    name="phone"
                  >
                    <Input placeholder={t('users.enter_phone') || '+966 50 123 4567'} size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col xs={24} md={8}>
                  <Form.Item 
                    label="Roles" 
                    name="roles" 
                    rules={[{ required: true, message: 'Please select at least one role' }]}
                  >
                    <Select 
                      mode="multiple" 
                      placeholder="Select roles"
                      size="large"
                      options={[
                        { label: 'Staff Member', value: 'staff' },
                        { label: 'User Access', value: 'user' },
                      ]} 
                    />
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={8}>
                  <Form.Item label="Language" name="language">
                    <Select 
                      placeholder="Select language"
                      size="large"
                      options={[
                        { label: 'Arabic', value: 'ar' },
                        { label: 'English', value: 'en' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={8}>
                  <Form.Item label="Branch ID" name="branchId">
                    <Input placeholder="Enter branch ID (optional)" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ marginTop: '32px', textAlign: 'center' }}>
                <Space size="middle">
                  <Button size="large" onClick={() => form.resetFields()}>
                    Reset Form
                  </Button>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={loading}
                    size="large"
                    icon={<SaveOutlined />}
                    className="btn-primary"
                  >
                    Create Staff Member
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


