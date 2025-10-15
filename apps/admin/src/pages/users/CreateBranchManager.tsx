import { useState } from 'react'
import { Button, Form, Input, Select, message, Space, Row, Col, Alert } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { ShopOutlined, SaveOutlined } from '@ant-design/icons'
import { apiGet, apiPost } from '../../api'
import '../../theme.css'

export default function CreateBranchManager() {
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
      await apiPost('/users/branch-manager', {
        email: values.email,
        name: values.name,
        password: values.password,
        roles: ['branch_manager'],
        phone: values.phone || undefined,
        language: values.language || 'ar',
        branchId: values.branchId,
      })
      message.success('Branch manager created successfully!')
      form.resetFields()
    } catch (e: any) {
      message.error(e?.message || 'Failed to create branch manager')
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
              <ShopOutlined style={{ marginRight: '12px' }} />
              Create Branch Manager
            </h1>
            <p className="page-subtitle">Add a new branch manager to oversee operations</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          <div className="custom-form">
            <Alert
              message="Important Notice"
              description="Branch managers have access to manage their assigned branch only. Make sure to provide the correct Branch ID."
              type="info"
              showIcon
              style={{ marginBottom: '32px' }}
            />

            <Form 
              form={form}
              layout="vertical" 
              onFinish={onFinish}
              initialValues={{ language: 'ar' }}
            >
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item 
                    label="Full Name" 
                    name="name" 
                    rules={[{ required: true, message: 'Please enter full name' }]}
                  >
                    <Input placeholder="Enter manager's full name" size="large" />
                  </Form.Item>
                </Col>
                
                <Col xs={24} md={12}>
                  <Form.Item 
                    label="Email Address" 
                    name="email" 
                    rules={[
                      { required: true, message: 'Please enter email' },
                      { type: 'email', message: 'Please enter a valid email' }
                    ]}
                  >
                    <Input type="email" placeholder="manager@company.com" size="large" />
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
                    label="Phone Number" 
                    name="phone"
                  >
                    <Input placeholder="+966 50 123 4567" size="large" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item 
                    label="Branch" 
                    name="branchId" 
                    rules={[{ required: true, message: 'Please select a branch' }]}
                  >
                    <Select
                      showSearch
                      size="large"
                      placeholder="Select branch"
                      loading={branchesLoading}
                      options={branchOptions}
                      filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
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
                    Create Branch Manager
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


