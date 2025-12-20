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

  const { data: branch, isLoading, refetch } = useQuery<any>({
    queryKey: ['branch', branchId],
    queryFn: async () => {
      const data = await apiGet(`/content/branches/${branchId}`)
      return data
    },
    retry: false,
  })

  const updateBranch = useMutation({
    mutationFn: async (body: any) => {
      return apiPatch(`/content/branches/${branchId}`, body)
    },
    onSuccess: () => {
      message.success(t('branches.updated') || 'Branch updated successfully')
      qc.invalidateQueries({ queryKey: ['branch', branchId] })
      qc.invalidateQueries({ queryKey: ['branches'] })
    },
    onError: (error: any) => {
      message.error(error?.message || (t('branches.update_failed') || 'Failed to update branch'))
    },
  })

  useEffect(() => {
    if (branch) {
      form.setFieldsValue({
        name_ar: branch.nameAr || branch.name_ar,
        name_en: branch.nameEn || branch.name_en,
        capacity: branch.capacity,
        isDecorated: branch.isDecorated,
        price_basePrice: branch.priceConfig?.basePrice,
        price_hourlyRate: branch.priceConfig?.hourlyRate,
        price_pricePerPerson: branch.priceConfig?.pricePerPerson,
        price_weekendMultiplier: branch.priceConfig?.weekendMultiplier,
        price_holidayMultiplier: branch.priceConfig?.holidayMultiplier,
        price_decorationPrice: branch.priceConfig?.decorationPrice,
        description_ar: branch.descriptionAr || branch.description_ar,
        description_en: branch.descriptionEn || branch.description_en,
        features: branch.hallFeatures || branch.features,
        images: branch.hallImages || branch.images,
        videoUrl: branch.hallVideoUrl || branch.videoUrl,
        status: branch.hallStatus || branch.status,
      })
    }
  }, [branch, form])

  const handleSubmit = (values: any) => {
    const body = {
      nameAr: values.name_ar,
      nameEn: values.name_en,
      capacity: Number(values.capacity || 0),
      isDecorated: !!values.isDecorated,
      hallPriceConfig: {
        basePrice: Number(values.price_basePrice || 0),
        hourlyRate: Number(values.price_hourlyRate || 0),
        pricePerPerson: Number(values.price_pricePerPerson || 0),
        weekendMultiplier: Number(values.price_weekendMultiplier || 1),
        holidayMultiplier: Number(values.price_holidayMultiplier || 1),
        decorationPrice: values.price_decorationPrice != null ? Number(values.price_decorationPrice) : undefined,
      },
      descriptionAr: values.description_ar || null,
      descriptionEn: values.description_en || null,
      hallFeatures: values.features?.length ? values.features : undefined,
      hallImages: values.images?.length ? values.images : undefined,
      hallVideoUrl: values.videoUrl || null,
      hallStatus: values.status || 'available',
    }
    updateBranch.mutate(body)
  }

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', textAlign: 'center', padding: '40px' }} />
  }

  if (!branch) {
    return (
      <Card>
        <p>{t('branches.not_found') || 'Branch not found.'}</p>
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
            <Form.Item name="name_ar" label={t('branches.name_ar') || 'الاسم (AR)'} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="name_en" label={t('branches.name_en') || 'الاسم (EN)'} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="capacity" label={t('branches.capacity') || 'السعة'} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="isDecorated" label={t('branches.decorated') || 'مزينة'}>
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
            <Form.Item name="price_basePrice" label={t('branches.base_price') || 'Base Price'}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="price_hourlyRate" label={t('branches.hourly_rate') || 'Hourly Rate'}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="price_pricePerPerson" label={t('branches.price_per_person') || 'Per Person'}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="price_weekendMultiplier" label={t('branches.weekend_multiplier') || 'Weekend Multiplier'}>
              <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="price_holidayMultiplier" label={t('branches.holiday_multiplier') || 'Holiday Multiplier'}>
              <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="price_decorationPrice" label={t('branches.decoration_price') || 'Decoration Price'}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="status" label={t('branches.status') || 'Status'}>
              <Select
                options={[
                  { label: t('branches.available') || 'Available', value: 'available' },
                  { label: t('branches.maintenance') || 'Maintenance', value: 'maintenance' },
                  { label: t('branches.reserved') || 'Reserved', value: 'reserved' },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="features" label={t('branches.features') || 'المزايا'}>
          <Select mode="tags" placeholder={t('branches.features_ph') || 'أدخل المزايا'} />
        </Form.Item>

        <Form.Item name="description_ar" label={t('branches.description_ar') || 'الوصف (AR)'}>
          <TextArea rows={3} />
        </Form.Item>

        <Form.Item name="description_en" label={t('branches.description_en') || 'الوصف (EN)'}>
          <TextArea rows={3} />
        </Form.Item>

        <Form.Item
          name="videoUrl"
          label={t('branches.video_url') || 'رابط فيديو YouTube'}
          help={t('branches.video_url_help') || 'أدخل رابط فيديو YouTube'}
        >
          <Input placeholder="https://www.youtube.com/watch?v=..." />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={updateBranch.isPending}>
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

