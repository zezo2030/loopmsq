import { useState } from 'react'
import { Card, Form, Input, Button, Select, Row, Col, Alert, Space } from 'antd'
import { SendOutlined, BellOutlined, PhoneOutlined, MailOutlined, UserOutlined } from '@ant-design/icons'
import { apiPost } from '../../api'
import '../../theme.css'

export default function Notifications() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFinish(values: any) {
    setLoading(true)
    setSuccess(null)
    setError(null)
    try {
      await apiPost('/notifications/promo', {
        userId: values.userId || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
        message: values.message,
        lang: values.lang || 'ar',
        channels: values.channels?.length ? values.channels : ['sms', 'push'],
      })
      setSuccess('تم إرسال الإشعار الترويجي بنجاح')
    } catch (e: any) {
      setError(e?.message || 'فشل إرسال الإشعار')
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
              <BellOutlined style={{ marginRight: '12px' }} />
              إرسال إشعارات ترويجية
            </h1>
            <p className="page-subtitle">أرسل رسائل ترويجية عبر SMS / Push / Email</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card className="custom-card">
                <Form layout="vertical" onFinish={onFinish} initialValues={{ lang: 'ar', channels: ['sms', 'push'] }}>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item name="userId" label="User ID (اختياري)">
                        <Input prefix={<UserOutlined />} placeholder="uuid-..." allowClear />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="phone" label="الهاتف (اختياري)">
                        <Input prefix={<PhoneOutlined />} placeholder="+9665..." allowClear />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item name="email" label="البريد الإلكتروني (اختياري)">
                        <Input prefix={<MailOutlined />} placeholder="user@example.com" allowClear />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="lang" label="اللغة">
                        <Select
                          options={[{ label: 'العربية', value: 'ar' }, { label: 'English', value: 'en' }]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    name="channels"
                    label="القنوات"
                    rules={[{ required: true, message: 'اختر قناة واحدة على الأقل' }]}
                  >
                    <Select
                      mode="multiple"
                      options={[
                        { label: 'SMS', value: 'sms' },
                        { label: 'Push', value: 'push' },
                        { label: 'Email', value: 'email' },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item
                    name="message"
                    label="نص الرسالة"
                    rules={[{ required: true, message: 'الرسالة مطلوبة' }]}
                  >
                    <Input.TextArea rows={6} placeholder="أدخل نص الرسالة الترويجية..." />
                  </Form.Item>

                  <Space direction="vertical" style={{ width: '100%' }}>
                    {success && <Alert type="success" message={success} showIcon />}
                    {error && <Alert type="error" message={error} showIcon />}
                    <Button type="primary" icon={<SendOutlined />} htmlType="submit" loading={loading}>
                      إرسال
                    </Button>
                  </Space>
                </Form>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card className="custom-card">
                <h3 style={{ marginBottom: 8 }}>نصائح</h3>
                <ul style={{ paddingInlineStart: 20, lineHeight: 1.8 }}>
                  <li>يمكنك التوجيه لمستخدم محدد عبر User ID أو رقم الهاتف.</li>
                  <li>اختر القنوات المناسبة للجمهور المستهدف.</li>
                  <li>تأكد من الموافقة على رسائل SMS حسب اللوائح.</li>
                </ul>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  )
}




