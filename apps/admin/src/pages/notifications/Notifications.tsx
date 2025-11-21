import { useState } from 'react'
import { Card, Form, Input, Button, Select, Row, Col, Alert, Space } from 'antd'
import { SendOutlined, BellOutlined } from '@ant-design/icons'
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
        message: values.message,
        lang: values.lang || 'ar',
        channels: ['push'], // إرسال فقط عبر Firebase Push
      })
      setSuccess('تم إرسال الإشعار لجميع الأجهزة بنجاح')
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
            <p className="page-subtitle">أرسل إشعارات ترويجية عبر Firebase لجميع الأجهزة</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card className="custom-card">
                <Form layout="vertical" onFinish={onFinish} initialValues={{ lang: 'ar' }}>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item name="lang" label="اللغة">
                        <Select
                          options={[{ label: 'العربية', value: 'ar' }, { label: 'English', value: 'en' }]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
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
                <h3 style={{ marginBottom: 8 }}>معلومات</h3>
                <ul style={{ paddingInlineStart: 20, lineHeight: 1.8 }}>
                  <li>سيتم إرسال الإشعار لجميع الأجهزة المسجلة عبر Firebase.</li>
                  <li>الإشعارات ترسل فقط عبر Firebase Push Notifications.</li>
                  <li>تأكد من أن الرسالة واضحة ومفيدة لجميع المستخدمين.</li>
                </ul>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  )
}




