import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Button, Card, Form, Input, Switch, Select, Tag, message, Row, Col, Descriptions } from 'antd'
import { UserOutlined, MailOutlined, PhoneOutlined, CalendarOutlined, BranchesOutlined, SaveOutlined } from '@ant-design/icons'
import { apiGet, apiPut } from '../../api'
import { useTranslation } from 'react-i18next'

type User = {
  id: string
  name?: string
  email?: string
  phone?: string
  roles?: string[]
  language?: string
  isActive?: boolean
  lastLoginAt?: string
  createdAt?: string
  updatedAt?: string
  branchId?: string
  branch?: {
    id: string
    name_ar?: string
    name_en?: string
    location?: string
  }
}

export default function UserDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [form] = Form.useForm<User>()
  const [saving, setSaving] = useState(false)
  const [userData, setUserData] = useState<User | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await apiGet<User>(`/users/${id}`)
        if (!mounted) return
        setUserData(data)
        form.setFieldsValue({
          name: data.name,
          email: data.email,
          phone: data.phone,
          language: data.language || 'ar',
          isActive: data.isActive,
          branchId: data.branchId,
        })
      } catch (e: any) {
        message.error(
          e?.message ||
          t('users.load_user_failed', { defaultValue: 'Failed to load user details' })
        )
      } finally {
        if (!mounted) return
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
        phone: values.phone,
        language: values.language,
        isActive: values.isActive,
        branchId: values.branchId,
      })
      message.success(
        t('users.updated_successfully', { defaultValue: 'User updated successfully' })
      )
    } catch (e: any) {
      message.error(
        e?.message ||
        t('users.update_failed', { defaultValue: 'Failed to update user' })
      )
    } finally {
      setSaving(false)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'red'
      case 'branch_manager': return 'blue'
      case 'staff': return 'green'
      case 'user': return 'default'
      default: return 'default'
    }
  }

  const getRoleLabel = (role: string) =>
    t(`roles.${role}`, { defaultValue: role.replace('_', ' ') })

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">
              <UserOutlined style={{ marginRight: '12px' }} />
              {t('users.user_details', { defaultValue: 'User Details' })}
            </h1>
            <p className="page-subtitle">
              {t('users.view_and_edit_user_info', { defaultValue: 'View and edit user information' })}
            </p>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          {userData && (
            <>
              {/* User Information Card */}
              <Card
                title={t('users.basic_information', { defaultValue: 'Basic Information' })}
                style={{ marginBottom: '24px' }}
                extra={
                  <Tag color={userData.isActive ? 'success' : 'default'}>
                    {userData.isActive ? (t('users.active') || 'Active') : (t('users.inactive') || 'Inactive')}
                  </Tag>
                }
              >
                <Form form={form} layout="vertical" onFinish={onSave}>
                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label={t('users.full_name', { defaultValue: 'Full Name' })}
                        name="name"
                        rules={[{ required: true, message: t('users.enter_full_name') || 'Please enter full name' }]}
                      >
                        <Input
                          prefix={<UserOutlined />}
                          placeholder={t('users.enter_full_name', { defaultValue: 'Enter full name' })}
                          size="large"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label={t('users.email_address', { defaultValue: 'Email Address' })}
                        name="email"
                        rules={[
                          { required: true, message: t('users.enter_email') || 'Please enter email' },
                          { type: 'email', message: t('users.enter_valid_email') || 'Please enter a valid email' }
                        ]}
                      >
                        <Input
                          prefix={<MailOutlined />}
                          type="email"
                          placeholder="user@example.com"
                          size="large"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label={t('users.phone_number', { defaultValue: 'Phone Number' })}
                        name="phone"
                      >
                        <Input
                          prefix={<PhoneOutlined />}
                          placeholder={t('users.enter_phone', { defaultValue: '+966 50 123 4567' })}
                          size="large"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label={t('users.language', { defaultValue: 'Language' })}
                        name="language"
                      >
                        <Select
                          placeholder={t('users.select_language', { defaultValue: 'Select language' })}
                          size="large"
                        >
                          <Select.Option value="ar">
                            {t('users.language_ar', { defaultValue: 'Arabic' })}
                          </Select.Option>
                          <Select.Option value="en">
                            {t('users.language_en', { defaultValue: 'English' })}
                          </Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={24}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label={t('users.status', { defaultValue: 'Status' })}
                        name="isActive"
                        valuePropName="checked"
                      >
                        <Switch
                          checkedChildren={t('users.active', { defaultValue: 'Active' })}
                          unCheckedChildren={t('users.inactive', { defaultValue: 'Inactive' })}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item style={{ marginTop: '32px', textAlign: 'center' }}>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={saving}
                      size="large"
                      icon={<SaveOutlined />}
                      className="btn-primary"
                    >
                      {t('common.save_changes', { defaultValue: 'Save Changes' })}
                    </Button>
                  </Form.Item>
                </Form>
              </Card>

              {/* Roles Information Card */}
              <Card
                title={t('users.roles_permissions', { defaultValue: 'Roles & Permissions' })}
                style={{ marginBottom: '24px' }}
              >
                <div style={{ marginBottom: '16px' }}>
                  <strong>{t('users.user_roles', { defaultValue: 'User Roles' })}:</strong>
                </div>
                <div style={{ marginBottom: '16px' }}>
                  {(userData.roles || []).map(role => (
                    <Tag key={role} color={getRoleColor(role)} style={{ marginRight: '8px', marginBottom: '8px' }}>
                      {getRoleLabel(role)}
                    </Tag>
                  ))}
                </div>
                {userData.branch && (
                  <div>
                    <strong>{t('users.assigned_branch', { defaultValue: 'Assigned Branch' })}:</strong>
                    <div style={{ marginTop: '8px' }}>
                      <Tag icon={<BranchesOutlined />} color="blue">
                        {userData.branch.name_ar || userData.branch.name_en}
                        {userData.branch.location ? ` - ${userData.branch.location}` : ''}
                      </Tag>
                    </div>
                  </div>
                )}
              </Card>

              {/* Account Information Card */}
              <Card title={t('users.account_information', { defaultValue: 'Account Information' })}>
                <Descriptions bordered column={2}>
                  <Descriptions.Item label={t('users.user_id', { defaultValue: 'User ID' })}>
                    <code>{userData.id}</code>
                  </Descriptions.Item>
                  <Descriptions.Item label={t('users.created_at', { defaultValue: 'Created At' })}>
                    <CalendarOutlined style={{ marginRight: '8px' }} />
                    {userData.createdAt ? new Date(userData.createdAt).toLocaleString('ar-SA', { calendar: 'gregory' }) : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('users.last_login', { defaultValue: 'Last Login' })}>
                    {userData.lastLoginAt
                      ? new Date(userData.lastLoginAt).toLocaleString('ar-SA', { calendar: 'gregory' })
                      : t('users.never_logged_in', { defaultValue: 'Never logged in' })}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('users.last_updated', { defaultValue: 'Last Updated' })}>
                    <CalendarOutlined style={{ marginRight: '8px' }} />
                    {userData.updatedAt ? new Date(userData.updatedAt).toLocaleString('ar-SA', { calendar: 'gregory' }) : '—'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}


