import { useState } from 'react'
import { useAdminAuth } from '../../auth'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, message, Space } from 'antd'
import { apiGet, apiPost, apiPut, apiPatch } from '../../api'
import { useTranslation } from 'react-i18next'

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
}

export default function Branches() {
  const { t } = useTranslation()
  const { me } = useAdminAuth()
  const canEdit = (me?.roles || []).includes('admin')
  const canUpdateStatus = canEdit || (me?.roles || []).includes('branch_manager')
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
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

  const columns = [
    { title: t('branches.id') || 'ID', dataIndex: 'id', key: 'id' },
    { title: t('branches.name_ar') || 'الاسم (AR)', dataIndex: 'name_ar', key: 'name_ar' },
    { title: t('branches.name_en') || 'الاسم (EN)', dataIndex: 'name_en', key: 'name_en' },
    { title: t('branches.location') || 'الموقع', dataIndex: 'location', key: 'location' },
    { title: t('branches.capacity') || 'السعة', dataIndex: 'capacity', key: 'capacity' },
    { title: t('branches.status') || 'الحالة', dataIndex: 'status', key: 'status' },
    {
      title: t('common.actions') || 'إجراءات',
      key: 'actions',
      render: (_: any, r: Branch) => (
        <Space>
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
            workingHours: r.workingHours ? JSON.stringify(r.workingHours, null, 2) : ''
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

  return (
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
            }
            if (values.workingHours) {
              try { payload.workingHours = JSON.parse(values.workingHours) } catch { message.error(t('branches.working_hours_invalid') || 'Invalid working hours JSON'); return }
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
          <Form.Item name="capacity" label={t('branches.capacity') || 'السعة'} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="contactPhone" label={t('branches.contact_phone') || 'هاتف التواصل'}>
            <Input />
          </Form.Item>
          <Form.Item name="amenities" label={t('branches.amenities') || 'الخدمات'}>
            <Select mode="tags" placeholder={t('branches.amenities_ph') || 'أدخل الخدمات'} />
          </Form.Item>
          <Form.Item name="workingHours" label={t('branches.working_hours') || 'أوقات العمل (JSON)'}>
            <Input.TextArea rows={6} placeholder='{"sunday":{"open":"09:00","close":"22:00"}}' />
          </Form.Item>
          <Form.Item name="description_ar" label={t('branches.description_ar') || 'الوصف (AR)'}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="description_en" label={t('branches.description_en') || 'الوصف (EN)'}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}


