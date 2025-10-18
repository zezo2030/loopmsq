import { useEffect, useState } from 'react'
import { Card, Form, Switch, Input, Button, message, Divider, Tabs, Space } from 'antd'
import { useTranslation } from 'react-i18next'
import { getSmsConfig, getOtpConfig, updateSmsConfig, updateOtpConfig, testSms, type OtpConfig } from '../shared/api'

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
    // Load server configs for SMS & OTP
    ;(async () => {
      try {
        const [sms, otp] = await Promise.all([
          getSmsConfig().catch(() => null),
          getOtpConfig().catch(() => null),
        ])
        const values: any = {}
        if (sms) {
          values.smsEnabled = sms.enabled
          values.twilioAccountSid = sms.twilioAccountSid || ''
          values.twilioFromNumber = sms.twilioFromNumber || ''
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
        // SMS Config - فقط أرسل الحقول التي تم تغييرها أو المطلوبة
        if (values.smsEnabled !== undefined || values.twilioFromNumber || values.twilioAccountSid || values.twilioAuthToken) {
          const smsPayload: any = {}

          if (values.smsEnabled !== undefined) {
            smsPayload.enabled = values.smsEnabled
          }

          if (values.twilioFromNumber) {
            // تحقق من صحة رقم الهاتف
            const phoneRegex = /^\+?[0-9]{7,15}$/
            if (phoneRegex.test(values.twilioFromNumber)) {
              smsPayload.twilioFromNumber = values.twilioFromNumber
            } else {
              message.error(t('settings.invalid_phone_format') || 'Invalid phone number format')
              return
            }
          }

          // فقط أضف Account SID إذا كان طوله مناسب وليس مخفي
          if (values.twilioAccountSid &&
              values.twilioAccountSid !== '****' &&
              values.twilioAccountSid.length >= 10) {
            smsPayload.twilioAccountSid = values.twilioAccountSid
          }

          // فقط أضف Auth Token إذا كان طوله مناسب وليس مخفي
          if (values.twilioAuthToken &&
              values.twilioAuthToken !== '****' &&
              values.twilioAuthToken.length >= 10) {
            smsPayload.twilioAuthToken = values.twilioAuthToken
          }

          // فقط أرسل إذا كان هناك بيانات للإرسال
          if (Object.keys(smsPayload).length > 0) {
            await updateSmsConfig(smsPayload)
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
      <Form.Item name="twilioAccountSid" label={t('settings.twilio_account_sid') || 'Twilio Account SID'}>
        <Input.Password placeholder={t('settings.twilio_account_sid_ph') || 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'} />
      </Form.Item>
      <Form.Item name="twilioAuthToken" label={t('settings.twilio_auth_token') || 'Twilio Auth Token'}>
        <Input.Password placeholder={t('settings.twilio_auth_token_ph') || 'Your Twilio Auth Token'} />
      </Form.Item>
      <Form.Item name="twilioFromNumber" label={t('settings.twilio_from_number') || 'Twilio From Number'}>
        <Input placeholder={t('settings.twilio_from_number_ph') || '+1234567890'} />
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

      <Space>
        <Button type="primary" htmlType="submit" loading={loading}>{t('common.save') || 'Save'}</Button>
        <Button onClick={async () => {
          const v = form.getFieldsValue()
          try {
            await testSms(v.testPhone || v.twilioFromNumber, 'Test message')
            message.success(t('settings.sms_test_success') || 'Test SMS sent')
          } catch (e: any) {
            message.error(e?.message || (t('settings.sms_test_failed') || 'SMS test failed'))
          }
        }}>{t('settings.test_sms') || 'Test SMS'}</Button>
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
          { key: 'sms', label: t('settings.sms_tab') || 'SMS & OTP', children: smsOtpTab },
        ]}
      />
    </Card>
  )
}


