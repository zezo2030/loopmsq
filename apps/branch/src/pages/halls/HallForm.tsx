import { useState, useEffect } from 'react'
import { Form, Input, Button, message, Row, Col, InputNumber, Select, Switch, Space, Divider } from 'antd'
import { SaveOutlined, CloseOutlined } from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'
import { apiPost, apiPut } from '../../api'
import { useBranchAuth } from '../../auth'

const { TextArea } = Input
const { Option } = Select

interface HallFormProps {
  hall?: any
  onSuccess: () => void
  onCancel: () => void
}

export default function HallForm({ hall, onSuccess, onCancel }: HallFormProps) {
  const { t } = useTranslation()
  const { me } = useBranchAuth()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [isEditMode] = useState(!!hall)

  useEffect(() => {
    if (hall) {
      form.setFieldsValue({
        nameAr: hall.name_ar,
        nameEn: hall.name_en,
        capacity: hall.capacity,
        status: hall.status,
        pricing: {
          base: hall.priceConfig?.basePrice,
          hourly: hall.priceConfig?.hourlyRate,
          weekend: hall.priceConfig?.weekendMultiplier,
          holiday: hall.priceConfig?.holidayMultiplier,
          decoration: hall.priceConfig?.decorationPrice,
        },
        features: hall.features,
        images: hall.images,
        decorated: hall.isDecorated,
        descriptionAr: hall.description_ar,
        descriptionEn: hall.description_en,
      })
    }
  }, [hall, form])

  const handleSubmit = async (values: any) => {
    if (!me?.branchId) return
    
    setLoading(true)
    try {
      const featuresArray = Array.isArray(values.features)
        ? values.features
        : (typeof values.features === 'string'
            ? values.features
                .split(/\r?\n|,/)
                .map((s: string) => s.trim())
                .filter(Boolean)
            : undefined)

      const imagesArray = Array.isArray(values.images)
        ? values.images
        : (typeof values.images === 'string'
            ? values.images
                .split(/\r?\n|,/)
                .map((s: string) => s.trim())
                .filter(Boolean)
            : undefined)

      const hallData = {
        branchId: me.branchId,
        name_ar: values.nameAr,
        name_en: values.nameEn,
        capacity: Number(values.capacity || 0),
        isDecorated: !!values.decorated,
        priceConfig: {
          basePrice: Number(values.pricing?.base || 0),
          hourlyRate: Number(values.pricing?.hourly || 0),
          weekendMultiplier: Number(values.pricing?.weekend || 1),
          holidayMultiplier: Number(values.pricing?.holiday || 1),
          decorationPrice: values.pricing?.decoration != null ? Number(values.pricing.decoration) : undefined,
        },
        description_ar: values.descriptionAr || null,
        description_en: values.descriptionEn || null,
        features: featuresArray && featuresArray.length ? featuresArray : undefined,
        images: imagesArray && imagesArray.length ? imagesArray : undefined,
      }

      
      // Validate required fields
      if (!hallData.name_ar || !hallData.name_en || !hallData.capacity || hallData.capacity <= 0) {
        message.error('Please fill in all required fields correctly')
        return
      }
      
      // Validate priceConfig
      if (!hallData.priceConfig.basePrice || hallData.priceConfig.basePrice <= 0) {
        message.error('Base price is required and must be greater than 0')
        return
      }

      if (isEditMode) {
        await apiPut(`/content/halls/${hall.id}`, hallData)
        message.success(t('halls.updated') || 'Hall updated successfully')
      } else {
        await apiPost('/content/halls', hallData)
        message.success(t('halls.created') || 'Hall created successfully')
      }
      
      onSuccess()
    } catch (error: any) {
      console.error('Hall creation error:', error)
      const errorMessage = error?.response?.data?.message || error?.message || t('halls.save_failed') || 'Failed to save hall'
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      className="custom-form"
    >
      {/* Basic Information */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('halls.name_ar') || 'Name (Arabic)'}
            name="nameAr"
            rules={[{ required: true, message: t('halls.name_ar_required') || 'Please enter Arabic name' }]}
          >
            <Input placeholder={t('halls.name_ar_ph') || 'Enter Arabic name'} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('halls.name_en') || 'Name (English)'}
            name="nameEn"
            rules={[{ required: true, message: t('halls.name_en_required') || 'Please enter English name' }]}
          >
            <Input placeholder={t('halls.name_en_ph') || 'Enter English name'} />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('halls.capacity') || 'Capacity'}
            name="capacity"
            rules={[{ required: true, message: t('halls.capacity_required') || 'Please enter capacity' }]}
          >
            <InputNumber 
              min={1} 
              style={{ width: '100%' }} 
              placeholder={t('halls.capacity_ph') || 'Enter capacity'} 
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('halls.status') || 'Status'}
            name="status"
            rules={[{ required: true, message: t('halls.status_required') || 'Please select status' }]}
          >
            <Select placeholder={t('halls.status_ph') || 'Select status'}>
              <Option value="available">{t('halls.available') || 'Available'}</Option>
              <Option value="maintenance">{t('halls.maintenance') || 'Maintenance'}</Option>
              <Option value="reserved">{t('halls.reserved') || 'Reserved'}</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Divider>{t('halls.pricing_section') || 'Pricing'}</Divider>

      {/* Pricing Information */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Form.Item
            label={t('halls.price_base') || 'Base Price (SAR)'}
            name={['pricing', 'base']}
            rules={[{ required: true, message: t('halls.base_price_required') || 'Please enter base price' }]}
          >
            <InputNumber 
              min={0} 
              style={{ width: '100%' }} 
              placeholder={t('halls.base_price_ph') || 'Enter base price'} 
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item
            label={t('halls.price_hourly') || 'Hourly Rate (SAR)'}
            name={['pricing', 'hourly']}
          >
            <InputNumber 
              min={0} 
              style={{ width: '100%' }} 
              placeholder={t('halls.hourly_rate_ph') || 'Enter hourly rate'} 
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item
            label={t('halls.price_weekend') || 'Weekend Multiplier'}
            name={['pricing', 'weekend']}
          >
            <InputNumber 
              min={1} 
              step={0.1}
              style={{ width: '100%' }} 
              placeholder={t('halls.weekend_multiplier_ph') || 'Enter weekend multiplier'} 
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Form.Item
            label={t('halls.price_holiday') || 'Holiday Multiplier'}
            name={['pricing', 'holiday']}
          >
            <InputNumber 
              min={1} 
              step={0.1}
              style={{ width: '100%' }} 
              placeholder={t('halls.holiday_multiplier_ph') || 'Enter holiday multiplier'} 
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item
            label={t('halls.price_decoration') || 'Decoration Fee (SAR)'}
            name={['pricing', 'decoration']}
          >
            <InputNumber 
              min={0} 
              style={{ width: '100%' }} 
              placeholder={t('halls.decoration_fee_ph') || 'Enter decoration fee'} 
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item
            label={t('halls.decorated') || 'Decorated'}
            name="decorated"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      <Divider>{t('halls.additional_info') || 'Additional Information'}</Divider>

      {/* Additional Information */}
      <Form.Item
        label={t('halls.features') || 'Features'}
        name="features"
      >
        <TextArea 
          rows={3} 
          placeholder={t('halls.features_ph') || 'Enter features (one per line)'}
        />
      </Form.Item>

      <Form.Item
        label={t('halls.images') || 'Images (URLs)'}
        name="images"
      >
        <TextArea 
          rows={3} 
          placeholder={t('halls.images_ph') || 'Enter image URLs (one per line)'}
        />
      </Form.Item>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('halls.description_ar') || 'Description (Arabic)'}
            name="descriptionAr"
          >
            <TextArea 
              rows={3} 
              placeholder={t('halls.description_ar') || 'Enter Arabic description'}
            />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            label={t('halls.description_en') || 'Description (English)'}
            name="descriptionEn"
          >
            <TextArea 
              rows={3} 
              placeholder={t('halls.description_en') || 'Enter English description'}
            />
          </Form.Item>
        </Col>
      </Row>

      {/* Form Actions */}
      <div style={{ textAlign: 'right', marginTop: '24px' }}>
        <Space>
          <Button onClick={onCancel} icon={<CloseOutlined />}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
            icon={<SaveOutlined />}
            className="btn-primary"
          >
            {isEditMode ? (t('common.update') || 'Update') : (t('common.create') || 'Create')}
          </Button>
        </Space>
      </div>
    </Form>
  )
}
