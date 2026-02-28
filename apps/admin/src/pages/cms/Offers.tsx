import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Switch, Table, message, Upload, Image, Space } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { resolveFileUrlWithBust } from '../../shared/url'
import { useState, useEffect, useMemo } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../api'
import dayjs from 'dayjs'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../shared/auth'
import { useTranslation } from 'react-i18next'

type Offer = {
  id: string
  branchId: string
  title: string
  description?: string | null
  discountType: 'percentage' | 'fixed'
  discountValue: number
  startsAt?: string | null
  endsAt?: string | null
  isActive: boolean
  imageUrl?: string | null
}

export default function Offers() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const location = useLocation()
  const { me } = useAuth()
  const isBranchMode = useMemo(() => location.pathname.startsWith('/branch'), [location.pathname])
  const enforcedBranchId = isBranchMode ? (me?.branchId || undefined) : undefined
  const [branchFilter, setBranchFilter] = useState<string | undefined>(enforcedBranchId)
  const { data, isLoading } = useQuery<Offer[]>({
    queryKey: ['offers', branchFilter, isBranchMode],
    queryFn: () => apiGet(`/admin/offers${(branchFilter || enforcedBranchId) ? `?branchId=${branchFilter || enforcedBranchId}` : ''}`)
  })
  const { data: branches } = useQuery<any[]>({ queryKey: ['branches:min'], queryFn: async () => {
    const res = await apiGet<any>('/content/branches?includeInactive=true')
    return Array.isArray(res) ? res : (res.items || res.branches || [])
  }})
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Offer | null>(null)
  const [form] = Form.useForm()

  const createMutation = useMutation({
    mutationFn: (body: Partial<Offer>) => apiPost<Offer>('/admin/offers', body),
    onSuccess: () => { message.success(t('offers.created')); qc.invalidateQueries({ queryKey: ['offers'] }); setOpen(false) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Offer> }) => apiPatch(`/admin/offers/${id}`, body),
    onSuccess: () => { message.success(t('offers.updated')); qc.invalidateQueries({ queryKey: ['offers'] }); setOpen(false); setEditing(null) },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/offers/${id}`),
    onSuccess: () => { message.success(t('offers.removed')); qc.invalidateQueries({ queryKey: ['offers'] }) },
  })

  // Auto-set hall when modal opens (each branch has one hall)
  useEffect(() => {
    if (open && editing && editing.branchId) {
      // Branch is already set from editing.branchId
    }
  }, [open, editing, isBranchMode, enforcedBranchId, form])

  const columns = [
    { title: t('offers.branch'), dataIndex: 'branchId', render: (v: string) => branches?.find(b => b.id === v)?.name_en || v },
    { title: t('offers.title'), dataIndex: 'title' },
    { title: t('offers.image'), dataIndex: 'imageUrl', render: (v: string) => v ? <Image src={resolveFileUrlWithBust(v)} width={80} height={50} style={{ objectFit: 'cover' }} /> : '-' },
    { title: t('offers.type'), dataIndex: 'discountType' },
    { title: t('offers.value'), dataIndex: 'discountValue' },
    { title: t('offers.active'), dataIndex: 'isActive', render: (v: boolean) => (v ? t('offers.yes') : t('offers.no')) },
    { title: t('offers.schedule'), render: (_: any, r: Offer) => `${r.startsAt ?? '-'} → ${r.endsAt ?? '-'}` },
    { title: t('offers.actions'), render: (_: any, r: Offer) => (
      <span style={{ display: 'flex', gap: 8 }}>
        <Button size="small" onClick={() => { setEditing(r); form.setFieldsValue({
          ...r,
          range: [r.startsAt ? dayjs(r.startsAt) : null, r.endsAt ? dayjs(r.endsAt) : null]
        }); setOpen(true) }}>{t('offers.edit')}</Button>
        <Button size="small" danger onClick={() => deleteMutation.mutate(r.id)}>{t('offers.delete')}</Button>
      </span>
    )},
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Space>
          {!isBranchMode && (
            <Select
              allowClear
              placeholder={t('offers.filter_by_branch')}
              style={{ width: 240 }}
              value={branchFilter}
              onChange={(v) => setBranchFilter(v)}
              options={(branches || []).map(b => ({ value: b.id, label: b.name_en }))}
            />
          )}
        </Space>
        <Button type="primary" onClick={() => { 
          setEditing(null); 
          form.resetFields(); 
          setOpen(true);
        }}>{t('offers.new_offer')}</Button>
      </div>
      <Table rowKey="id" loading={isLoading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? t('offers.edit_offer') : t('offers.create_offer')}
        open={open}
        onCancel={() => { 
          setOpen(false); 
          setEditing(null);
          form.resetFields();
        }}
        onOk={() => {
          form.validateFields().then(values => {
            const body: any = {
              branchId: enforcedBranchId || values.branchId,
              title: values.title,
              description: values.description || null,
              discountType: values.discountType,
              discountValue: Number(values.discountValue),
              isActive: values.isActive ?? true,
              imageUrl: values.imageUrl || null,
            }
            const [start, end] = values.range || []
            body.startsAt = start ? start.toISOString() : null
            body.endsAt = end ? end.toISOString() : null
            if (editing) updateMutation.mutate({ id: editing.id, body })
            else createMutation.mutate(body)
          })
        }}
      >
        <Form form={form} layout="vertical" initialValues={{ discountType: 'percentage', isActive: true }}>
          {!isBranchMode && (
            <Form.Item name="branchId" label={t('offers.branch')} rules={[{ required: true }]}>
              <Select
                placeholder={t('offers.select_branch')}
                options={(branches || []).map(b => ({ value: b.id, label: b.name_en }))}
                onChange={() => {
                  // Branch is set, backend will handle the rest
                }}
              />
            </Form.Item>
          )}
          {/* Hall selection is hidden - automatically linked to branch's single hall */}
          <Form.Item name="title" label={t('offers.title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label={t('offers.image')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              {form.getFieldValue('imageUrl') ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <Image src={resolveFileUrlWithBust(form.getFieldValue('imageUrl'))} width={200} height={120} style={{ objectFit: 'cover', borderRadius: 8 }} />
                </div>
              ) : null}
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  const fd = new FormData()
                  fd.append('file', file)
                  apiPost<{ imageUrl: string }>('/admin/offers/upload', fd)
                    .then((res) => {
                      form.setFieldsValue({ imageUrl: res.imageUrl })
                      message.success(t('offers.image_uploaded'))
                    })
                    .catch(() => message.error(t('offers.upload_failed')))
                  return false
                }}
              >
                <Button icon={<UploadOutlined />}>{t('offers.upload_image')}</Button>
              </Upload>
              <Form.Item name="imageUrl" hidden> 
                <Input />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="description" label={t('offers.description')}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="discountType" label={t('offers.discount_type')} rules={[{ required: true }]}>
            <Select options={[{ value: 'percentage', label: t('offers.percentage') }, { value: 'fixed', label: t('offers.fixed') }]} />
          </Form.Item>
          <Form.Item name="discountValue" label={t('offers.discount_value')} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="range" label={t('offers.schedule')}>
            <DatePicker.RangePicker showTime />
          </Form.Item>
          <Form.Item name="isActive" label={t('offers.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}


