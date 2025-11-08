import { useState } from 'react'
import { useAdminAuth } from '../../auth'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, message, Space, Upload, Image, Tabs, Row, Col } from 'antd'
import { resolveFileUrl } from '../../shared/url'
import { UploadOutlined, DeleteOutlined } from '@ant-design/icons'
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '../../api'
import { useTranslation } from 'react-i18next'
import WorkingHoursEditor from '../../components/WorkingHoursEditor'
import BranchOffersTab from '../../components/BranchOffersTab'
import BranchCouponsTab from '../../components/BranchCouponsTab'

type Branch = {
  id: string
  name_ar: string
  name_en: string
  location: string
  capacity: number
  description_ar?: string | null
  description_en?: string | null
  contactPhone?: string | null
  workingHours?: Record<string, { open: string; close: string; closed?: boolean }>
  amenities?: string[]
  status?: 'active' | 'inactive' | 'maintenance'
  coverImage?: string | null
  images?: string[]
  latitude?: number | null
  longitude?: number | null
}

export default function Branches() {
  const { t } = useTranslation()
  const { me } = useAdminAuth()
  const canEdit = (me?.roles || []).includes('admin')
  const canUpdateStatus = canEdit || (me?.roles || []).includes('branch_manager')
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [activeTab, setActiveTab] = useState('list')
  const [form] = Form.useForm()

  const { data, isLoading } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiGet<any>('/content/branches?includeInactive=true')
      return Array.isArray(res) ? res : (res.items || res.branches || [])
    },
  })

  const createBranch = useMutation({
    mutationFn: async (payload: Partial<Branch>) => apiPost('/content/branches', payload),
    onSuccess: () => { message.success(t('branches.created') || 'Branch created'); qc.invalidateQueries({ queryKey: ['branches'] }); setOpen(false) },
  })
  const updateBranch = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Branch> }) => apiPut(`/content/branches/${id}`, body),
    onSuccess: () => { message.success(t('branches.updated') || 'Branch updated'); qc.invalidateQueries({ queryKey: ['branches'] }); setOpen(false); setEditing(null) },
  })
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: NonNullable<Branch['status']> }) => apiPatch(`/content/branches/${id}/status`, { status }),
    onSuccess: () => { message.success(t('branches.status_updated') || 'Status updated'); qc.invalidateQueries({ queryKey: ['branches'] }) },
  })

  const handleCoverImageUpload = async (file: any, branchId: string) => {
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const updated = await apiPost<Branch>(`/content/branches/${branchId}/upload-cover`, formData)
      message.success(t('branches.image_uploaded') || 'Image uploaded successfully')
      // حدث الحالة المحلية فوراً لعرض الصورة بدون انتظار إعادة الجلب
      setEditing((prev) => (prev && prev.id === branchId ? { ...prev, coverImage: updated.coverImage || prev.coverImage } : prev))
      if (selectedBranch && selectedBranch.id === branchId) {
        setSelectedBranch({ ...selectedBranch, coverImage: updated.coverImage || selectedBranch.coverImage })
      }
      qc.invalidateQueries({ queryKey: ['branches'] })
      return false // Prevent default upload
    } catch (error) {
      message.error(t('branches.image_upload_failed') || 'Failed to upload image')
      return false
    }
  }

  const handleImagesUpload = async (fileList: any[], branchId: string) => {
    const formData = new FormData()
    fileList.forEach(file => {
      formData.append('files', file)
    })
    
    try {
      const updated = await apiPost<Branch>(`/content/branches/${branchId}/upload-images`, formData)
      message.success(t('branches.image_uploaded') || 'Images uploaded successfully')
      // تحديث فوري للحالة المحلية
      setEditing((prev) => (prev && prev.id === branchId ? { ...prev, images: updated.images || prev.images } : prev))
      if (selectedBranch && selectedBranch.id === branchId) {
        setSelectedBranch({ ...selectedBranch, images: updated.images || selectedBranch.images })
      }
      qc.invalidateQueries({ queryKey: ['branches'] })
      return false // Prevent default upload
    } catch (error) {
      message.error(t('branches.image_upload_failed') || 'Failed to upload images')
      return false
    }
  }

  const handleDeleteImage = async (imageUrl: string, branchId: string) => {
    const filename = imageUrl.split('/').pop()
    if (!filename) return
    
    try {
      await apiDelete(`/content/branches/${branchId}/images/${filename}`)
      message.success(t('branches.image_deleted') || 'Image deleted successfully')
      qc.invalidateQueries({ queryKey: ['branches'] })
    } catch (error) {
      message.error(t('branches.image_delete_failed') || 'Failed to delete image')
    }
  }

  const columns = [
    { title: t('branches.id') || 'ID', dataIndex: 'id', key: 'id' },
    { title: t('branches.name_ar') || 'الاسم (AR)', dataIndex: 'name_ar', key: 'name_ar' },
    { title: t('branches.name_en') || 'الاسم (EN)', dataIndex: 'name_en', key: 'name_en' },
    { title: t('branches.location') || 'الموقع', dataIndex: 'location', key: 'location' },
    { title: t('branches.capacity') || 'السعة', dataIndex: 'capacity', key: 'capacity' },
    { title: t('branches.status') || 'الحالة', dataIndex: 'status', key: 'status' },
    { 
      title: t('branches.cover_image') || 'صورة الغلاف', 
      dataIndex: 'coverImage', 
      key: 'coverImage',
      render: (coverImage: string | null) => (
        coverImage ? (
          <Image
            src={resolveFileUrl(coverImage)}
            alt="Cover"
            style={{ width: 50, height: 50, objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          <span style={{ color: '#999' }}>لا توجد صورة</span>
        )
      )
    },
    {
      title: t('common.actions') || 'إجراءات',
      key: 'actions',
      render: (_: any, r: Branch) => (
        <Space>
          <Button size="small" onClick={() => { setSelectedBranch(r); setActiveTab('details'); form.setFieldsValue({
            name_ar: r.name_ar,
            name_en: r.name_en,
            location: r.location,
            capacity: r.capacity,
            description_ar: r.description_ar,
            description_en: r.description_en,
            contactPhone: r.contactPhone,
            amenities: r.amenities,
            status: r.status,
            workingHours: r.workingHours || {},
            latitude: r.latitude,
            longitude: r.longitude
          }); setEditing(r) }}>
            {t('common.view_details') || 'View Details'}
          </Button>
          <Button size="small" disabled={!canEdit} onClick={() => { setEditing(r); form.setFieldsValue({
            name_ar: r.name_ar,
            name_en: r.name_en,
            location: r.location,
            capacity: r.capacity,
            description_ar: r.description_ar,
            description_en: r.description_en,
            contactPhone: r.contactPhone,
            amenities: r.amenities,
            status: r.status,
            workingHours: r.workingHours || {},
            latitude: r.latitude,
            longitude: r.longitude
          }); setOpen(true) }}>{t('common.edit') || 'تعديل'}</Button>
          <Select
            value={r.status}
            style={{ width: 160 }}
            disabled={!canUpdateStatus}
            onChange={(v) => updateStatus.mutate({ id: r.id, status: v as any })}
            options={[
              { label: t('branches.active') || 'Active', value: 'active' },
              { label: t('branches.inactive') || 'Inactive', value: 'inactive' },
              { label: t('branches.maintenance') || 'Maintenance', value: 'maintenance' },
            ]}
          />
        </Space>
      ),
    },
  ]

  if (selectedBranch && activeTab !== 'list') {
    return (
      <div className="page-container" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
        <Card 
          title={`${t('branches.title') || 'الفروع'} - ${selectedBranch.name_en}`}
          extra={
            <Space>
              <Button onClick={() => { setSelectedBranch(null); setActiveTab('list'); setEditing(null) }}>
                {t('common.back') || 'Back to List'}
              </Button>
              <Button type="primary" disabled={!canEdit} onClick={() => { setEditing(selectedBranch); form.setFieldsValue({
                name_ar: selectedBranch.name_ar,
                name_en: selectedBranch.name_en,
                location: selectedBranch.location,
                capacity: selectedBranch.capacity,
                description_ar: selectedBranch.description_ar,
                description_en: selectedBranch.description_en,
                contactPhone: selectedBranch.contactPhone,
                amenities: selectedBranch.amenities,
                status: selectedBranch.status,
                workingHours: selectedBranch.workingHours || {},
                latitude: selectedBranch.latitude,
                longitude: selectedBranch.longitude
              }); setOpen(true) }}>
                {t('common.edit') || 'Edit'}
              </Button>
            </Space>
          }
        >
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            items={[
              {
                key: 'details',
                label: t('branches.details') || 'Details',
                children: (
                  <div>
                    <p><strong>{t('branches.name_ar') || 'الاسم (AR)'}:</strong> {selectedBranch.name_ar}</p>
                    <p><strong>{t('branches.name_en') || 'الاسم (EN)'}:</strong> {selectedBranch.name_en}</p>
                    <p><strong>{t('branches.location') || 'الموقع'}:</strong> {selectedBranch.location}</p>
                    <p><strong>{t('branches.capacity') || 'السعة'}:</strong> {selectedBranch.capacity}</p>
                    <p><strong>{t('branches.status') || 'الحالة'}:</strong> {selectedBranch.status}</p>
                    {selectedBranch.description_ar && <p><strong>{t('branches.description_ar') || 'الوصف (AR)'}:</strong> {selectedBranch.description_ar}</p>}
                    {selectedBranch.description_en && <p><strong>{t('branches.description_en') || 'الوصف (EN)'}:</strong> {selectedBranch.description_en}</p>}
                    {selectedBranch.coverImage && (
                      <div style={{ marginTop: 16 }}>
                        <strong>{t('branches.cover_image') || 'صورة الغلاف'}:</strong>
                        <Image src={resolveFileUrl(selectedBranch.coverImage)} width={200} height={150} style={{ marginTop: 8, objectFit: 'cover', borderRadius: 8 }} />
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'offers',
                label: t('offers.title') || 'Offers',
                children: <BranchOffersTab branchId={selectedBranch.id} />,
              },
              {
                key: 'coupons',
                label: t('coupons.title') || 'Coupons',
                children: <BranchCouponsTab branchId={selectedBranch.id} />,
              },
            ]}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
      <Card title={t('branches.title') || 'الفروع'} extra={<Button type="primary" disabled={!canEdit} onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>{t('branches.new') || 'فرع جديد'}</Button>}>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data || []}
        columns={columns as any}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editing ? (t('branches.edit_title') || 'تعديل فرع') : (t('branches.create_title') || 'إنشاء فرع')}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null) }}
        onOk={() => form.submit()}
        okText={editing ? (t('common.update') || 'تحديث') : (t('common.create') || 'إنشاء')}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            const payload: any = {
              name_ar: values.name_ar,
              name_en: values.name_en,
              location: values.location,
              capacity: Number(values.capacity || 0),
              description_ar: values.description_ar || null,
              description_en: values.description_en || null,
              contactPhone: values.contactPhone || null,
              amenities: values.amenities?.length ? values.amenities : undefined,
              status: values.status || 'active',
              latitude: values.latitude ? Number(values.latitude) : null,
              longitude: values.longitude ? Number(values.longitude) : null,
            }
            if (values.workingHours) {
              payload.workingHours = values.workingHours
            }
            if (!canEdit) { message.error(t('errors.forbidden') || 'Forbidden'); return }
            if (editing) updateBranch.mutate({ id: editing.id, body: payload })
            else createBranch.mutate(payload)
          }}
        >
          <Form.Item name="name_ar" label={t('branches.name_ar') || 'الاسم (AR)'} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name_en" label={t('branches.name_en') || 'الاسم (EN)'} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="location" label={t('branches.location') || 'الموقع'} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          
          {/* Location Coordinates */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                name="latitude" 
                label="Latitude (خط العرض)"
                tooltip="مثال: 24.7136"
              >
                <InputNumber 
                  step={0.00000001} 
                  precision={8} 
                  style={{ width: '100%' }}
                  placeholder="24.7136"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                name="longitude" 
                label="Longitude (خط الطول)"
                tooltip="مثال: 46.6753"
              >
                <InputNumber 
                  step={0.00000001} 
                  precision={8} 
                  style={{ width: '100%' }}
                  placeholder="46.6753"
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="capacity" label={t('branches.capacity') || 'السعة'} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="contactPhone" label={t('branches.contact_phone') || 'هاتف التواصل'}>
            <Input />
          </Form.Item>
          <Form.Item name="amenities" label={t('branches.amenities') || 'الخدمات'}>
            <Select mode="tags" placeholder={t('branches.amenities_ph') || 'أدخل الخدمات'} />
          </Form.Item>
          <Form.Item name="workingHours" label={t('branches.working_hours') || 'أوقات العمل'}>
            <WorkingHoursEditor />
          </Form.Item>
          <Form.Item name="description_ar" label={t('branches.description_ar') || 'الوصف (AR)'}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="description_en" label={t('branches.description_en') || 'الوصف (EN)'}>
            <Input.TextArea rows={3} />
          </Form.Item>
          
          {/* Cover Image */}
          <Form.Item label={t('branches.cover_image') || 'صورة الغلاف'}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {editing?.coverImage ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <Image
                    src={resolveFileUrl(editing.coverImage)}
                    alt="Cover"
                    style={{ width: 200, height: 150, objectFit: 'cover', borderRadius: 8 }}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteImage(editing.coverImage!, editing.id)}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                  />
                </div>
              ) : (
                <Upload
                  disabled={!editing?.id}
                  beforeUpload={(file) => {
                    if (!editing?.id) {
                      message.error(t('branches.save_first') || 'احفظ الفرع أولاً قبل رفع الصورة')
                      return Upload.LIST_IGNORE
                    }
                    return handleCoverImageUpload(file, editing.id)
                  }}
                  showUploadList={false}
                  accept="image/*"
                >
                  <Button icon={<UploadOutlined />}>
                    {t('branches.upload_cover') || 'رفع صورة الغلاف'}
                  </Button>
                </Upload>
              )}
            </Space>
          </Form.Item>

          {/* Additional Images */}
          <Form.Item label={t('branches.images') || 'الصور الإضافية'}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {editing?.images && editing.images.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {editing.images.map((imageUrl: string, index: number) => (
                    <div key={index} style={{ position: 'relative', display: 'inline-block' }}>
                      <Image
                        src={resolveFileUrl(imageUrl)}
                        alt={`Image ${index + 1}`}
                        style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8 }}
                      />
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteImage(imageUrl, editing.id)}
                        style={{ position: 'absolute', top: 4, right: 4 }}
                      />
                    </div>
                  ))}
                </div>
              )}
              
              <Upload
                disabled={!editing?.id || (editing?.images && editing.images.length >= 5)}
                beforeUpload={(file) => {
                  if (!editing?.id) {
                    message.error(t('branches.save_first') || 'احفظ الفرع أولاً قبل رفع الصور')
                    return Upload.LIST_IGNORE
                  }
                  // Upload only the current file to avoid duplicate uploads
                  handleImagesUpload([file], editing.id)
                  return false
                }}
                showUploadList={false}
                accept="image/*"
                multiple
              >
                <Button 
                  icon={<UploadOutlined />}
                  disabled={!editing?.id || (editing?.images && editing.images.length >= 5)}
                >
                  {t('branches.upload_images') || 'رفع صور إضافية'}
                </Button>
              </Upload>
              
              {editing?.images && editing.images.length >= 5 && (
                <span style={{ color: '#999', fontSize: '12px' }}>
                  {t('branches.max_images') || 'الحد الأقصى 5 صور'}
                </span>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      </Card>
    </div>
  )
}


