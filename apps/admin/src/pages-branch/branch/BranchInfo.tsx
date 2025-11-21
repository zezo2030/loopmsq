import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, message, Row, Col, Select, Space, Typography, Divider } from 'antd'
import { SaveOutlined, EditOutlined } from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'
import { apiGet, apiPut } from '../../shared/api'
import { useAuth } from '../../shared/auth'
import WorkingHoursEditor from '../../components/WorkingHoursEditor'

const { TextArea } = Input
const { Option } = Select

export default function BranchInfo() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [branchData, setBranchData] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    loadBranchData()
  }, [])

  const loadBranchData = async () => {
    if (!me?.branchId) return
    
    try {
      const data: any = await apiGet(`/content/branches/${me.branchId}`)
      setBranchData(data)
      form.setFieldsValue({
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        location: data.location,
        capacity: data.capacity,
        status: data.status,
        contactPhone: data.contactPhone,
        amenities: data.amenities,
        workingHours: data.workingHours,
        descriptionAr: data.descriptionAr,
        descriptionEn: data.descriptionEn,
        videoUrl: data.videoUrl,
      })
    } catch (error) {
      message.error(t('branch.load_failed') || 'Failed to load branch data')
    }
  }

  const handleSave = async (values: any) => {
    if (!me?.branchId) return
    
    setLoading(true)
    try {
      await apiPut(`/content/branches/${me.branchId}`, values)
      message.success(t('branch.updated') || 'Branch updated successfully')
      setIsEditing(false)
      loadBranchData()
    } catch (error) {
      message.error(t('branch.update_failed') || 'Failed to update branch')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    if (!me?.branchId) return
    
    try {
      await apiPut(`/content/branches/${me.branchId}`, { status })
      message.success(t('branch.status_updated') || 'Status updated successfully')
      loadBranchData()
    } catch (error) {
      message.error(t('branch.status_update_failed') || 'Failed to update status')
    }
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">{t('branch.title') || 'Branch Information'}</h1>
            <p className="page-subtitle">{t('branch.subtitle') || 'Manage your branch details and settings'}</p>
          </div>
          <Space>
            <Button 
              type={isEditing ? 'default' : 'primary'} 
              icon={isEditing ? <SaveOutlined /> : <EditOutlined />}
              onClick={() => {
                if (isEditing) {
                  form.submit()
                } else {
                  setIsEditing(true)
                }
              }}
              loading={loading}
            >
              {isEditing ? (t('common.save') || 'Save') : (t('common.edit') || 'Edit')}
            </Button>
            {isEditing && (
              <Button onClick={() => {
                setIsEditing(false)
                loadBranchData()
              }}>
                {t('common.cancel') || 'Cancel'}
              </Button>
            )}
          </Space>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          <Row gutter={[24, 24]}>
            {/* Branch Details */}
            <Col xs={24} lg={16}>
              <Card className="custom-card" title={t('branch.details') || 'Branch Details'}>
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSave}
                  disabled={!isEditing}
                  className="custom-form"
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label={t('branch.name_ar') || 'Name (Arabic)'}
                        name="nameAr"
                        rules={[{ required: true, message: t('branch.name_ar_required') || 'Please enter Arabic name' }]}
                      >
                        <Input placeholder={t('branch.name_ar_ph') || 'Enter Arabic name'} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label={t('branch.name_en') || 'Name (English)'}
                        name="nameEn"
                        rules={[{ required: true, message: t('branch.name_en_required') || 'Please enter English name' }]}
                      >
                        <Input placeholder={t('branch.name_en_ph') || 'Enter English name'} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label={t('branch.location') || 'Location'}
                        name="location"
                        rules={[{ required: true, message: t('branch.location_required') || 'Please enter location' }]}
                      >
                        <Input placeholder={t('branch.location_ph') || 'Enter branch location'} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label={t('branch.capacity') || 'Capacity'}
                        name="capacity"
                        rules={[{ required: true, message: t('branch.capacity_required') || 'Please enter capacity' }]}
                      >
                        <Input type="number" placeholder={t('branch.capacity_ph') || 'Enter capacity'} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label={t('branch.contact_phone') || 'Contact Phone'}
                        name="contactPhone"
                      >
                        <Input placeholder={t('branch.contact_phone_ph') || 'Enter contact phone'} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label={t('branch.status') || 'Status'}
                        name="status"
                      >
                        <Select>
                          <Option value="active">{t('branch.active') || 'Active'}</Option>
                          <Option value="inactive">{t('branch.inactive') || 'Inactive'}</Option>
                          <Option value="maintenance">{t('branch.maintenance') || 'Maintenance'}</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label={t('branch.amenities') || 'Amenities'}
                    name="amenities"
                  >
                    <TextArea 
                      rows={3} 
                      placeholder={t('branch.amenities_ph') || 'Enter amenities (one per line)'}
                    />
                  </Form.Item>

                  <Form.Item
                    label={t('branch.working_hours') || 'Working Hours'}
                    name="workingHours"
                  >
                    <WorkingHoursEditor />
                  </Form.Item>

                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label={t('branch.description_ar') || 'Description (Arabic)'}
                        name="descriptionAr"
                      >
                        <TextArea rows={3} placeholder={t('branch.description_ar_ph') || 'Enter Arabic description'} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        label={t('branch.description_en') || 'Description (English)'}
                        name="descriptionEn"
                      >
                        <TextArea rows={3} placeholder={t('branch.description_en_ph') || 'Enter English description'} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label={t('branch.video_url') || 'YouTube Video URL'}
                    name="videoUrl"
                    help={t('branch.video_url_help') || 'Enter YouTube video URL (e.g., https://www.youtube.com/watch?v=VIDEO_ID)'}
                  >
                    <Input placeholder="https://www.youtube.com/watch?v=..." />
                  </Form.Item>
                </Form>
              </Card>
            </Col>

            {/* Branch Status & Quick Actions */}
            <Col xs={24} lg={8}>
              <Card className="custom-card" title={t('branch.status_management') || 'Status Management'}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Typography.Text strong>{t('branch.current_status') || 'Current Status'}:</Typography.Text>
                    <div style={{ marginTop: '8px' }}>
                      <Select
                        value={branchData?.status}
                        onChange={handleStatusChange}
                        style={{ width: '100%' }}
                      >
                        <Option value="active">{t('branch.active') || 'Active'}</Option>
                        <Option value="inactive">{t('branch.inactive') || 'Inactive'}</Option>
                        <Option value="maintenance">{t('branch.maintenance') || 'Maintenance'}</Option>
                      </Select>
                    </div>
                  </div>

                  <Divider />

                  <div>
                    <Typography.Text strong>{t('branch.branch_id') || 'Branch ID'}:</Typography.Text>
                    <div style={{ marginTop: '8px', fontFamily: 'monospace', fontSize: '12px', color: '#666' }}>
                      {me?.branchId || 'N/A'}
                    </div>
                  </div>

                  <Divider />

                  <div>
                    <Typography.Text strong>{t('branch.last_updated') || 'Last Updated'}:</Typography.Text>
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                      {branchData?.updatedAt ? new Date(branchData.updatedAt).toLocaleString('ar-SA', { calendar: 'gregory' }) : 'N/A'}
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </div>
      </div>
    </div>
  )
}


