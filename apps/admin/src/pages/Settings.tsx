import { useEffect, useState } from 'react'
import { Card, Form, Switch, Input, Button, message, Divider, Tabs, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import { getWhatsAppConfig, getOtpConfig, updateWhatsAppConfig, updateOtpConfig, testWhatsApp, type OtpConfig } from '../shared/api'

export default function Settings() {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const analyticsEnabled = localStorage.getItem('settings.analyticsEnabled') === 'true'
      const gtmId = localStorage.getItem('settings.gtmId') || ''
      const pixelEnabled = localStorage.getItem('settings.pixelEnabled') === 'true'
      const pixelId = localStorage.getItem('settings.pixelId') || ''
      form.setFieldsValue({ analyticsEnabled, gtmId, pixelEnabled, pixelId })
    } catch {}
    // Load server configs for WhatsApp & OTP
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
  }, [form])

  const onSave = async (values: any) => {
    setLoading(true)
      try {
      // Local analytics
      localStorage.setItem('settings.analyticsEnabled', values.analyticsEnabled ? 'true' : 'false')
      if (values.gtmId !== undefined) localStorage.setItem('settings.gtmId', values.gtmId)
      localStorage.setItem('settings.pixelEnabled', values.pixelEnabled ? 'true' : 'false')
      if (values.pixelId !== undefined) localStorage.setItem('settings.pixelId', values.pixelId)

      // Backend configs
      try {
        // WhatsApp Config
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
          // Only send token when it's updated and not masked.
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

        // OTP Config
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
    <Form form={form} layout="vertical" onFinish={onSave}>
      <Form.Item name="smsEnabled" label={t('settings.enable_sms') || 'Enable SMS Service'} valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item name="whatsappAccessToken" label={t('settings.whatsapp_access_token') || 'WhatsApp Access Token'}>
        <Input.Password placeholder={t('settings.whatsapp_access_token_ph') || 'EAAB...'} />
      </Form.Item>
      <Form.Item name="whatsappPhoneNumberId" label={t('settings.whatsapp_phone_number_id') || 'WhatsApp Phone Number ID'}>
        <Input placeholder={t('settings.whatsapp_phone_number_id_ph') || '123456789012345'} />
      </Form.Item>

      <Divider />

      <Form.Item name="otpEnabled" label={t('settings.enable_otp') || 'Enable OTP Verification'} valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item name="otpLength" label={t('settings.otp_length') || 'OTP Length'}>
        <Input type="number" min={4} max={8} placeholder="6" />
      </Form.Item>
      <Form.Item name="otpExpiry" label={t('settings.otp_expiry') || 'OTP Expiry (seconds)'}>
        <Input type="number" min={60} max={600} placeholder="300" />
      </Form.Item>
      <Form.Item name="otpRateTtl" label={t('settings.otp_rate_ttl') || 'Rate Limit TTL (seconds)'}>
        <Input type="number" min={60} max={3600} placeholder="300" />
      </Form.Item>
      <Form.Item name="otpRateMax" label={t('settings.otp_rate_max') || 'Rate Limit Max Attempts'}>
        <Input type="number" min={1} max={10} placeholder="3" />
      </Form.Item>

      <Form.Item name="testPhone" label={t('settings.test_phone') || 'Test Phone Number'}>
        <Input placeholder={t('settings.test_phone_ph') || '+966500000000'} />
      </Form.Item>

      <Space>
        <Button type="primary" htmlType="submit" loading={loading}>{t('common.save') || 'Save'}</Button>
        <Button onClick={async () => {
          const v = form.getFieldsValue()
          try {
            await testWhatsApp(v.testPhone, '123456')
            message.success(t('settings.whatsapp_test_success') || 'Test WhatsApp message sent')
          } catch (e: any) {
            message.error(e?.message || (t('settings.whatsapp_test_failed') || 'WhatsApp test failed'))
          }
        }}>{t('settings.test_whatsapp') || 'Test WhatsApp'}</Button>
      </Space>
    </Form>
  )

  const analyticsTab = (
    <Form form={form} layout="vertical" onFinish={onSave}>
      <Form.Item name="analyticsEnabled" label={t('settings.enable_analytics') || 'Enable Analytics'} valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item name="gtmId" label={t('settings.gtm_id') || 'GTM ID (e.g., GTM-XXXXXXX)'}>
        <Input placeholder={t('settings.gtm_ph') || 'GTM-XXXXXXX'} />
      </Form.Item>
      <Divider />
      <Form.Item name="pixelEnabled" label={t('settings.enable_pixel') || 'Enable Meta Pixel'} valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item name="pixelId" label={t('settings.pixel_id') || 'Meta Pixel ID'}>
        <Input placeholder={t('settings.pixel_ph') || '1234567890'} />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={loading}>{t('common.save') || 'Save'}</Button>
    </Form>
  )

  return (
    <Card title={t('settings.title') || 'Settings'}>
      <Tabs
        defaultActiveKey="analytics"
        items={[
          { key: 'analytics', label: t('settings.analytics_tab') || 'Analytics', children: analyticsTab },
          { key: 'sms', label: t('settings.sms_tab') || 'WhatsApp & OTP', children: smsOtpTab },
        ]}
      />
    </Card>
  )
}


