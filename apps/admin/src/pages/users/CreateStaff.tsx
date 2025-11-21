import { useState } from 'react'
import { Button, Form, Input, Select, message, Space, Row, Col } from 'antd'
import { UserAddOutlined, SaveOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api'
import { useTranslation } from 'react-i18next'
import '../../theme.css'

export default function CreateStaff() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  // Load branches for dropdown
  const { data: branches, isLoading: branchesLoading } = useQuery<any[]>({
    queryKey: ['branches', 'for-select'],
    queryFn: async () => {
      const res = await apiGet<any>('/content/branches?includeInactive=true')
      return Array.isArray(res) ? res : (res.items || res.branches || [])
    },
  })
  const branchOptions = (branches || []).map((b: any) => ({
    label: `${b?.name_ar || b?.name_en} — ${b?.location || ''}`.trim(),
    value: b.id,
  }))

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
      message.success(t('staff.created') || 'Staff member created successfully!')
      form.resetFields()
    } catch (e: any) {
      message.error(e?.message || t('staff.create_failed') || 'Failed to create staff member')
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
              {t('page.create_staff') || 'Create Staff Member'}
            </h1>
            <p className="page-subtitle">{t('staff.create_subtitle') || 'Add a new staff member to your team'}</p>
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
                    label={t('users.roles') || 'Roles'} 
                    name="roles" 
                    rules={[{ required: true, message: t('users.select_role_required') || 'Please select at least one role' }]}
                  >
                    <Select 
                      mode="multiple" 
                      placeholder={t('users.select_roles') || 'Select roles'}
                      size="large"
                      options={[
                        { label: t('roles.staff') || 'Staff Member', value: 'staff' },
                        { label: t('roles.user') || 'User Access', value: 'user' },
                      ]} 
                    />
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={8}>
                  <Form.Item label={t('users.language') || 'Language'} name="language">
                    <Select 
                      placeholder={t('users.select_language') || 'Select language'}
                      size="large"
                      options={[
                        { label: t('users.language_ar') || 'Arabic', value: 'ar' },
                        { label: t('users.language_en') || 'English', value: 'en' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={8}>
                  <Form.Item label={t('users.branch') || 'Branch'} name="branchId">
                    <Select
                      showSearch
                      allowClear
                      size="large"
                      placeholder={t('users.select_branch_optional') || 'Select branch (optional)'}
                      loading={branchesLoading}
                      options={branchOptions}
                      filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
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
                    {t('page.create_staff') || 'Create Staff Member'}
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


