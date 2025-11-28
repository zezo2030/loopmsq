import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Form, Input, InputNumber, Select, Button, message, Row, Col, Space, Card, Spin } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { apiGet, apiPatch } from '../shared/api'
import { useTranslation } from 'react-i18next'

const { TextArea } = Input

interface BranchHallTabProps {
  branchId: string
}

export default function BranchHallTab({ branchId }: BranchHallTabProps) {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const qc = useQueryClient()

  const { data: hall, isLoading, refetch } = useQuery<any>({
    queryKey: ['branch-hall', branchId],
    queryFn: async () => {
      const data = await apiGet(`/content/branches/${branchId}/hall`)
      return data
    },
    retry: false,
  })

  const updateHall = useMutation({
    mutationFn: async (body: any) => {
      return apiPatch(`/content/branches/${branchId}/hall`, body)
    },
    onSuccess: () => {
      message.success(t('halls.updated') || 'Hall updated successfully')
      qc.invalidateQueries({ queryKey: ['branch-hall', branchId] })
      qc.invalidateQueries({ queryKey: ['branches'] })
    },
    onError: (error: any) => {
      message.error(error?.message || (t('halls.update_failed') || 'Failed to update hall'))
    },
  })

  useEffect(() => {
    if (hall) {
      form.setFieldsValue({
        name_ar: hall.name_ar,
        name_en: hall.name_en,
        capacity: hall.capacity,
        isDecorated: hall.isDecorated,
        price_basePrice: hall.priceConfig?.basePrice,
        price_hourlyRate: hall.priceConfig?.hourlyRate,
        price_pricePerPerson: hall.priceConfig?.pricePerPerson,
        price_weekendMultiplier: hall.priceConfig?.weekendMultiplier,
        price_holidayMultiplier: hall.priceConfig?.holidayMultiplier,
        price_decorationPrice: hall.priceConfig?.decorationPrice,
        description_ar: hall.description_ar,
        description_en: hall.description_en,
        features: hall.features,
        images: hall.images,
        videoUrl: hall.videoUrl,
        status: hall.status,
      })
    }
  }, [hall, form])

  const handleSubmit = (values: any) => {
    const body = {
      name_ar: values.name_ar,
      name_en: values.name_en,
      capacity: Number(values.capacity || 0),
      isDecorated: !!values.isDecorated,
      priceConfig: {
        basePrice: Number(values.price_basePrice || 0),
        hourlyRate: Number(values.price_hourlyRate || 0),
        pricePerPerson: Number(values.price_pricePerPerson || 0),
        weekendMultiplier: Number(values.price_weekendMultiplier || 1),
        holidayMultiplier: Number(values.price_holidayMultiplier || 1),
        decorationPrice: values.price_decorationPrice != null ? Number(values.price_decorationPrice) : undefined,
      },
      description_ar: values.description_ar || null,
      description_en: values.description_en || null,
      features: values.features?.length ? values.features : undefined,
      images: values.images?.length ? values.images : undefined,
      videoUrl: values.videoUrl || null,
    }
    updateHall.mutate(body)
  }

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', textAlign: 'center', padding: '40px' }} />
  }

  if (!hall) {
    return (
      <Card>
        <p>{t('halls.no_hall_found') || 'No hall found for this branch. Hall should be created automatically when branch is created.'}</p>
      </Card>
    )
  }

  return (
    <Card>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="name_ar" label={t('halls.name_ar') || 'الاسم (AR)'} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="name_en" label={t('halls.name_en') || 'الاسم (EN)'} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="capacity" label={t('halls.capacity') || 'السعة'} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="isDecorated" label={t('halls.decorated') || 'مزينة'}>
              <Select
                options={[
                  { label: t('common.yes') || 'Yes', value: true },
                  { label: t('common.no') || 'No', value: false }
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="price_basePrice" label={t('halls.price_base') || 'Base Price'}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="price_hourlyRate" label={t('halls.price_hourly') || 'Hourly Rate'}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="price_pricePerPerson" label={t('halls.price_per_person') || 'Per Person'}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="price_weekendMultiplier" label={t('halls.price_weekend') || 'Weekend Multiplier'}>
              <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="price_holidayMultiplier" label={t('halls.price_holiday') || 'Holiday Multiplier'}>
              <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="price_decorationPrice" label={t('halls.price_decoration') || 'Decoration Price'}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="status" label={t('halls.status') || 'Status'}>
              <Select
                options={[
                  { label: t('halls.available') || 'Available', value: 'available' },
                  { label: t('halls.maintenance') || 'Maintenance', value: 'maintenance' },
                  { label: t('halls.reserved') || 'Reserved', value: 'reserved' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="features" label={t('halls.features') || 'المزايا'}>
          <Select mode="tags" placeholder={t('halls.features_ph') || 'أدخل المزايا'} />
        </Form.Item>

        <Form.Item name="description_ar" label={t('halls.description_ar') || 'الوصف (AR)'}>
          <TextArea rows={3} />
        </Form.Item>

        <Form.Item name="description_en" label={t('halls.description_en') || 'الوصف (EN)'}>
          <TextArea rows={3} />
        </Form.Item>

        <Form.Item
          name="videoUrl"
          label={t('halls.video_url') || 'رابط فيديو YouTube'}
          help={t('halls.video_url_help') || 'أدخل رابط فيديو YouTube'}
        >
          <Input placeholder="https://www.youtube.com/watch?v=..." />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={updateHall.isPending}>
              {t('common.save') || 'Save'}
            </Button>
            <Button onClick={() => refetch()}>
              {t('common.refresh') || 'Refresh'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}

