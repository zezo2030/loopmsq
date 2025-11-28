import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, message, Row, Col, Select, Switch, Space, Typography, Divider, Upload, Image, Tabs } from 'antd'
import { SaveOutlined, EditOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'
import { apiGet, apiPut, apiPost, apiDelete } from '../../api'
import { useBranchAuth } from '../../auth'
import WorkingHoursEditor from '../../components/WorkingHoursEditor'
import BranchHallTab from '../../components/BranchHallTab'

const { TextArea } = Input
const { Option } = Select

export default function BranchInfo() {
  const { t } = useTranslation()
  const { me } = useBranchAuth()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [branchData, setBranchData] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

  useEffect(() => {
    loadBranchData()
  }, [])

  const loadBranchData = async () => {
    if (!me?.branchId) return
    
    try {
      const data = await apiGet(`/content/branches/${me.branchId}`)
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

  const handleCoverImageUpload = async (file: any) => {
    if (!me?.branchId) return false
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      await apiPost(`/content/branches/${me.branchId}/upload-cover`, formData)
      message.success(t('branch.image_uploaded') || 'Image uploaded successfully')
      loadBranchData()
      return false // Prevent default upload
    } catch (error) {
      message.error(t('branch.image_upload_failed') || 'Failed to upload image')
      return false
    }
  }

  const handleImagesUpload = async (fileList: any[]) => {
    if (!me?.branchId) return false
    
    const formData = new FormData()
    fileList.forEach(file => {
      formData.append('files', file)
    })
    
    try {
      await apiPost(`/content/branches/${me.branchId}/upload-images`, formData)
      message.success(t('branch.image_uploaded') || 'Images uploaded successfully')
      loadBranchData()
      return false // Prevent default upload
    } catch (error) {
      message.error(t('branch.image_upload_failed') || 'Failed to upload images')
      return false
    }
  }

  const handleDeleteImage = async (imageUrl: string) => {
    if (!me?.branchId) return
    
    const filename = imageUrl.split('/').pop()
    if (!filename) return
    
    try {
      await apiDelete(`/content/branches/${me.branchId}/images/${filename}`)
      message.success(t('branch.image_deleted') || 'Image deleted successfully')
      loadBranchData()
    } catch (error) {
      message.error(t('branch.image_delete_failed') || 'Failed to delete image')
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
          <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: 24 }}>
            <Tabs.TabPane key="details" tab={t('branch.details') || 'Branch Details'}>
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
                </Form>
              </Card>
            </Col>

            {/* Branch Images */}
            <Col xs={24} lg={16}>
              <Card className="custom-card" title={t('branch.cover_image') || 'Cover Image'}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {branchData?.coverImage ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <Image
                        src={branchData.coverImage}
                        alt="Cover"
                        style={{ width: 200, height: 150, objectFit: 'cover', borderRadius: 8 }}
                      />
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteImage(branchData.coverImage)}
                        style={{ position: 'absolute', top: 8, right: 8 }}
                      />
                    </div>
                  ) : (
                    <Upload
                      beforeUpload={handleCoverImageUpload}
                      showUploadList={false}
                      accept="image/*"
                    >
                      <Button icon={<UploadOutlined />}>
                        {t('branch.upload_cover') || 'Upload Cover Image'}
                      </Button>
                    </Upload>
                  )}
                </Space>
              </Card>
            </Col>

            {/* Additional Images */}
            <Col xs={24} lg={16}>
              <Card className="custom-card" title={t('branch.images') || 'Additional Images'}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {branchData?.images && branchData.images.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {branchData.images.map((imageUrl: string, index: number) => (
                        <div key={index} style={{ position: 'relative', display: 'inline-block' }}>
                          <Image
                            src={imageUrl}
                            alt={`Image ${index + 1}`}
                            style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }}
                          />
                          <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteImage(imageUrl)}
                            style={{ position: 'absolute', top: 4, right: 4 }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <Upload
                    beforeUpload={(file, fileList) => {
                      handleImagesUpload([file, ...fileList])
                      return false
                    }}
                    showUploadList={false}
                    accept="image/*"
                    multiple
                    disabled={branchData?.images && branchData.images.length >= 5}
                  >
                    <Button 
                      icon={<UploadOutlined />}
                      disabled={branchData?.images && branchData.images.length >= 5}
                    >
                      {t('branch.upload_images') || 'Upload Additional Images'}
                    </Button>
                  </Upload>
                  
                  {branchData?.images && branchData.images.length >= 5 && (
                    <Typography.Text type="secondary">
                      {t('branch.max_images') || 'Maximum 5 images'}
                    </Typography.Text>
                  )}
                </Space>
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
        </Tabs.TabPane>
        <Tabs.TabPane key="hall" tab={t('halls.title') || 'Hall'}>
          {me?.branchId && <BranchHallTab branchId={me.branchId} />}
        </Tabs.TabPane>
      </Tabs>
        </div>
      </div>
    </div>
  )
}
