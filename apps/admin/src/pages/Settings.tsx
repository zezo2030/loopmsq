import { useEffect, useState } from 'react'
import { Card, Form, Switch, Input, Button, message, Divider } from 'antd'
import { useTranslation } from 'react-i18next'

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
  }, [form])

  return (
    <Card title={t('settings.title') || 'Settings'}>
      <Form form={form} layout="vertical" onFinish={(values) => {
        setLoading(true)
        try {
          localStorage.setItem('settings.analyticsEnabled', values.analyticsEnabled ? 'true' : 'false')
          if (values.gtmId !== undefined) localStorage.setItem('settings.gtmId', values.gtmId)

          localStorage.setItem('settings.pixelEnabled', values.pixelEnabled ? 'true' : 'false')
          if (values.pixelId !== undefined) localStorage.setItem('settings.pixelId', values.pixelId)
          message.success(t('settings.saved') || 'Saved')
          setTimeout(() => window.location.reload(), 500)
        } catch (e: any) {
          message.error(e?.message || (t('settings.save_failed') || 'Failed to save'))
        } finally {
          setLoading(false)
        }
      }}>
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
    </Card>
  )
}


