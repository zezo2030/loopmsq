import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined,
  BarChartOutlined,
  MessageOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import { Card, Form, Switch, Input, Button, message, Tabs, Space, Row, Col, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import {
  getWhatsAppConfig,
  getOtpConfig,
  updateWhatsAppConfig,
  updateOtpConfig,
  testWhatsApp,
  getPrivateEventTermsConfig,
  updatePrivateEventTermsConfig,
  type OtpConfig,
} from '../shared/api'

const { Title, Text } = Typography

const sectionBox: CSSProperties = {
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--background-main)',
  padding: 20,
  marginBottom: 20,
}

const tabPaneWrap: CSSProperties = {
  padding: '8px 4px 4px',
  maxWidth: 920,
}

function FormActions({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'flex-end',
        marginTop: 24,
        paddingTop: 20,
        borderTop: '1px solid var(--border-color)',
      }}
    >
      {children}
    </div>
  )
}

export default function Settings() {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [privateEventTermsForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [privateEventTermsLoading, setPrivateEventTermsLoading] = useState(false)

  useEffect(() => {
    try {
      const analyticsEnabled = localStorage.getItem('settings.analyticsEnabled') === 'true'
      const gtmId = localStorage.getItem('settings.gtmId') || ''
      const pixelEnabled = localStorage.getItem('settings.pixelEnabled') === 'true'
      const pixelId = localStorage.getItem('settings.pixelId') || ''
      form.setFieldsValue({ analyticsEnabled, gtmId, pixelEnabled, pixelId })
    } catch {}

    ;(async () => {
      try {
        const [whatsapp, otp] = await Promise.all([
          getWhatsAppConfig().catch(() => null),
          getOtpConfig().catch(() => null),
        ])
        const values: any = {}
        if (whatsapp) {
          values.smsEnabled = whatsapp.enabled
          values.whatsappAccessToken = (whatsapp as any).whatsappAccessToken || ''
          values.whatsappPhoneNumberId = (whatsapp as any).whatsappPhoneNumberId || ''
        }
        if (otp) {
          values.otpEnabled = otp.enabled
          values.otpLength = otp.length
          values.otpExpiry = otp.expirySeconds
          values.otpRateTtl = otp.rateTtlSeconds
          values.otpRateMax = otp.rateMaxAttempts
        }
        form.setFieldsValue(values)
      } catch {}
    })()

    ;(async () => {
      setPrivateEventTermsLoading(true)
      try {
        const privateEventTerms = await getPrivateEventTermsConfig().catch(() => null)
        const terms = privateEventTerms?.terms?.length
          ? privateEventTerms.terms
          : ['']
        privateEventTermsForm.setFieldsValue({
          terms: terms.map((term) => ({ value: term })),
        })
      } catch {
        privateEventTermsForm.setFieldsValue({ terms: [{ value: '' }] })
      } finally {
        setPrivateEventTermsLoading(false)
      }
    })()
  }, [form, privateEventTermsForm])

  const onSave = async (values: any) => {
    setLoading(true)
    try {
      localStorage.setItem('settings.analyticsEnabled', values.analyticsEnabled ? 'true' : 'false')
      if (values.gtmId !== undefined) localStorage.setItem('settings.gtmId', values.gtmId)
      localStorage.setItem('settings.pixelEnabled', values.pixelEnabled ? 'true' : 'false')
      if (values.pixelId !== undefined) localStorage.setItem('settings.pixelId', values.pixelId)

      try {
        if (
          values.smsEnabled !== undefined ||
          values.whatsappAccessToken ||
          values.whatsappPhoneNumberId
        ) {
          const whatsappPayload: any = { provider: 'whatsapp' }

          if (values.smsEnabled !== undefined) {
            whatsappPayload.enabled = values.smsEnabled
          }

          if (values.whatsappPhoneNumberId) {
            whatsappPayload.whatsappPhoneNumberId = values.whatsappPhoneNumberId
          }

          if (
            values.whatsappAccessToken &&
            values.whatsappAccessToken !== '****' &&
            String(values.whatsappAccessToken).length >= 10
          ) {
            whatsappPayload.whatsappAccessToken = values.whatsappAccessToken
          }

          if (Object.keys(whatsappPayload).length > 1) {
            await updateWhatsAppConfig(whatsappPayload)
          }
        }

        const otpPayload: Partial<OtpConfig> = {
          enabled: values.otpEnabled,
          length: Number(values.otpLength || 6),
          expirySeconds: Number(values.otpExpiry || 300),
          rateTtlSeconds: Number(values.otpRateTtl || 300),
          rateMaxAttempts: Number(values.otpRateMax || 3),
        }
        await updateOtpConfig(otpPayload)

        message.success(t('settings.saved') || 'Saved')
      } catch (e: any) {
        console.error('Settings save error:', e)
        message.error(e?.message || (t('settings.save_failed') || 'Failed to save'))
      }
    } catch (e: any) {
      message.error(e?.message || (t('settings.save_failed') || 'Failed to save'))
    } finally {
      setLoading(false)
    }
  }

  const smsOtpTab = (
    <div style={tabPaneWrap}>
      <Form form={form} layout="vertical" onFinish={onSave} requiredMark="optional">
        <div style={sectionBox}>
          <Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
            {t('settings.whatsapp_section') || 'WhatsApp Cloud API'}
          </Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {t('settings.whatsapp_section_hint') || 'Credentials for sending OTP and notifications via WhatsApp.'}
          </Text>
          <Form.Item name="smsEnabled" label={t('settings.enable_sms') || 'Enable SMS Service'} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Row gutter={[16, 0]}>
            <Col xs={24} lg={12}>
              <Form.Item name="whatsappAccessToken" label={t('settings.whatsapp_access_token') || 'WhatsApp Access Token'}>
                <Input.Password placeholder={t('settings.whatsapp_access_token_ph') || 'EAAB...'} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="whatsappPhoneNumberId" label={t('settings.whatsapp_phone_number_id') || 'WhatsApp Phone Number ID'}>
                <Input placeholder={t('settings.whatsapp_phone_number_id_ph') || '123456789012345'} />
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div style={sectionBox}>
          <Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
            {t('settings.otp_section') || 'OTP verification'}
          </Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {t('settings.otp_section_hint') || 'Control code length, expiry, and rate limiting for sign-in OTPs.'}
          </Text>
          <Form.Item name="otpEnabled" label={t('settings.enable_otp') || 'Enable OTP Verification'} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item name="otpLength" label={t('settings.otp_length') || 'OTP Length'}>
                <Input type="number" min={4} max={8} placeholder="6" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="otpExpiry" label={t('settings.otp_expiry') || 'OTP Expiry (seconds)'}>
                <Input type="number" min={60} max={600} placeholder="300" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="otpRateTtl" label={t('settings.otp_rate_ttl') || 'Rate Limit TTL (seconds)'}>
                <Input type="number" min={60} max={3600} placeholder="300" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="otpRateMax" label={t('settings.otp_rate_max') || 'Rate Limit Max Attempts'}>
                <Input type="number" min={1} max={10} placeholder="3" />
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div style={{ ...sectionBox, marginBottom: 0 }}>
          <Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
            {t('settings.test_section') || 'Test send'}
          </Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {t('settings.test_section_hint') || 'Send a test message to verify WhatsApp configuration (save credentials first).'}
          </Text>
          <Row gutter={[16, 16]} align="bottom">
            <Col xs={24} md={14}>
              <Form.Item name="testPhone" label={t('settings.test_phone') || 'Test Phone Number'} style={{ marginBottom: 0 }}>
                <Input placeholder={t('settings.test_phone_ph') || '+966500000000'} />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Button
                onClick={async () => {
                  const v = form.getFieldsValue()
                  try {
                    await testWhatsApp(v.testPhone, '123456')
                    message.success(t('settings.whatsapp_test_success') || 'Test WhatsApp message sent')
                  } catch (e: any) {
                    message.error(e?.message || (t('settings.whatsapp_test_failed') || 'WhatsApp test failed'))
                  }
                }}
              >
                {t('settings.test_whatsapp') || 'Test WhatsApp'}
              </Button>
            </Col>
          </Row>
        </div>

        <FormActions>
          <Button type="primary" htmlType="submit" loading={loading} size="large">
            {t('common.save') || 'Save'}
          </Button>
        </FormActions>
      </Form>
    </div>
  )

  const analyticsTab = (
    <div style={tabPaneWrap}>
      <Form form={form} layout="vertical" onFinish={onSave} requiredMark="optional">
        <div style={sectionBox}>
          <Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
            {t('settings.gtm_section') || 'Google Tag Manager'}
          </Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {t('settings.gtm_section_hint') || 'Loads in the admin app when enabled. Stored in this browser only.'}
          </Text>
          <Form.Item name="analyticsEnabled" label={t('settings.enable_analytics') || 'Enable Analytics'} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="gtmId" label={t('settings.gtm_id') || 'GTM ID (e.g., GTM-XXXXXXX)'}>
            <Input placeholder={t('settings.gtm_ph') || 'GTM-XXXXXXX'} />
          </Form.Item>
        </div>

        <div style={{ ...sectionBox, marginBottom: 0 }}>
          <Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
            {t('settings.pixel_section') || 'Meta (Facebook) Pixel'}
          </Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            {t('settings.pixel_section_hint') || 'Track conversions from the admin interface when enabled.'}
          </Text>
          <Form.Item name="pixelEnabled" label={t('settings.enable_pixel') || 'Enable Meta Pixel'} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="pixelId" label={t('settings.pixel_id') || 'Meta Pixel ID'} style={{ marginBottom: 0 }}>
            <Input placeholder={t('settings.pixel_ph') || '1234567890'} />
          </Form.Item>
        </div>

        <FormActions>
          <Button type="primary" htmlType="submit" loading={loading} size="large">
            {t('common.save') || 'Save'}
          </Button>
        </FormActions>
      </Form>
    </div>
  )

  const privateEventsTab = (
    <div style={tabPaneWrap}>
      <Form
        form={privateEventTermsForm}
        layout="vertical"
        requiredMark="optional"
        onFinish={async (values: { terms?: Array<{ value?: string }> }) => {
          setPrivateEventTermsLoading(true)
          try {
            const terms = (values.terms || [])
              .map((item) => item?.value?.trim() || '')
              .filter(Boolean)
            await updatePrivateEventTermsConfig({ terms })
            privateEventTermsForm.setFieldsValue({
              terms: terms.map((term) => ({ value: term })),
            })
            message.success('تم حفظ شروط وأحكام المناسبات الخاصة')
          } catch (e: any) {
            message.error(e?.message || 'فشل في حفظ شروط وأحكام المناسبات الخاصة')
          } finally {
            setPrivateEventTermsLoading(false)
          }
        }}
      >
        <div style={{ ...sectionBox, marginBottom: 0 }}>
          <Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
            شروط وأحكام المناسبات الخاصة
          </Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
            تُعرض للمستخدمين عند حجز مناسبة خاصة. أضِف البنود بالترتيب الذي يجب أن يظهر به في التطبيق.
          </Text>
          <Form.List name="terms">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {fields.map((field, index) => (
                  <Row key={field.key} gutter={[12, 0]} align="top" wrap={false}>
                    <Col flex="auto" style={{ minWidth: 0 }}>
                      <div
                        style={{
                          padding: 16,
                          background: 'var(--background-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <Form.Item
                          {...field}
                          name={[field.name, 'value']}
                          label={`البند ${index + 1}`}
                          style={{ marginBottom: 0 }}
                        >
                          <Input.TextArea rows={2} placeholder="اكتب بندًا من الشروط أو الأحكام" />
                        </Form.Item>
                      </div>
                    </Col>
                    <Col flex="none">
                      <Button
                        danger
                        type="text"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(field.name)}
                        aria-label={`حذف البند ${index + 1}`}
                        style={{ marginTop: 36 }}
                      />
                    </Col>
                  </Row>
                ))}

                <Button icon={<PlusOutlined />} onClick={() => add({ value: '' })} block type="dashed">
                  إضافة بند
                </Button>
              </Space>
            )}
          </Form.List>
        </div>

        <FormActions>
          <Button type="primary" htmlType="submit" loading={privateEventTermsLoading} size="large">
            حفظ الشروط
          </Button>
        </FormActions>
      </Form>
    </div>
  )

  const tabLabel = (icon: ReactNode, text: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {icon}
      {text}
    </span>
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">
              <SettingOutlined style={{ marginInlineEnd: 12 }} />
              {t('settings.title') || 'Settings'}
            </h1>
            <p className="page-subtitle">
              {t('settings.page_subtitle') || 'إدارة التكاملات، التحليلات، وشروط المناسبات الخاصة.'}
            </p>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          <Card className="custom-card" styles={{ body: { padding: 0 } }}>
            <Tabs
              defaultActiveKey="analytics"
              size="large"
              tabBarGutter={28}
              tabBarStyle={{ paddingInline: 24, paddingTop: 12, marginBottom: 0 }}
              items={[
                {
                  key: 'analytics',
                  label: tabLabel(<BarChartOutlined />, t('settings.analytics_tab') || 'Analytics'),
                  children: analyticsTab,
                },
                {
                  key: 'sms',
                  label: tabLabel(<MessageOutlined />, t('settings.sms_tab') || 'WhatsApp & OTP'),
                  children: smsOtpTab,
                },
                {
                  key: 'private-events',
                  label: tabLabel(<FileTextOutlined />, 'المناسبات الخاصة'),
                  children: privateEventsTab,
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
