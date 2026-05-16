import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Form, Image, Input, InputNumber, Modal, Select, Space, Switch, Table, Upload, message } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { apiDelete, apiGet, apiPost, apiPut } from '../../api'
import { resolveFileUrlWithBust } from '../../shared/url'
import { useTranslation } from 'react-i18next'

type Addon = {
  id: string
  name: string
  category?: string
  description?: string | null
  imageUrl?: string | null
  price: number
  defaultQuantity: number
  isActive: boolean
  metadata?: Record<string, any> | null
  branchId?: string | null
}

type BalloonColor = { name: string; hex: string }

type AddonFormValues = Partial<Addon> & {
  colors?: BalloonColor[]
}

type Branch = {
  id: string
  name_ar: string
  name_en: string
  hasEventBookings?: boolean
}

export default function PrivateEventAddons() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Addon | null>(null)
  const [form] = Form.useForm<AddonFormValues>()
  const [filters, setFilters] = useState<{ branchId?: string; isActive?: boolean }>({})

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches-with-event-bookings'],
    queryFn: async () => {
      const res = await apiGet<any>('/content/branches?includeInactive=true')
      const all = Array.isArray(res) ? res : (res.items || res.branches || [])
      return all.filter((branch: Branch) => branch.hasEventBookings !== false)
    },
  })

  const branchOptions = useMemo(
    () => (branches || []).map(branch => ({ value: branch.id, label: branch.name_ar || branch.name_en || branch.id })),
    [branches]
  )

  const { data, isLoading } = useQuery<Addon[]>({
    queryKey: ['private-event-addons', filters, branches],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.branchId) params.set('branchId', filters.branchId)
      if (typeof filters.isActive === 'boolean') params.set('isActive', String(filters.isActive))

      const allAddons = await apiGet(`/content/admin/special-booking-addons${params.toString() ? `?${params}` : ''}`)
      if (!Array.isArray(allAddons)) return []

      const branchIdsWithEventBookings = new Set((branches || []).map(branch => branch.id))
      return allAddons.filter((addon: Addon) => {
        const branchAllowed = !addon.branchId || branchIdsWithEventBookings.has(addon.branchId)
        return branchAllowed
      })
    },
    enabled: !!branches,
  })

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Addon>) => apiPost('/content/admin/special-booking-addons', payload),
    onSuccess: () => {
      message.success(t('common.created') || 'Created')
      qc.invalidateQueries({ queryKey: ['private-event-addons'] })
      qc.invalidateQueries({ queryKey: ['addons'] })
      setOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Addon> }) =>
      apiPut(`/content/admin/special-booking-addons/${id}`, body),
    onSuccess: () => {
      message.success(t('common.updated') || 'Updated')
      qc.invalidateQueries({ queryKey: ['private-event-addons'] })
      qc.invalidateQueries({ queryKey: ['addons'] })
      setOpen(false)
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/content/admin/special-booking-addons/${id}`),
    onSuccess: () => {
      message.success(t('common.deleted') || 'Deleted')
      qc.invalidateQueries({ queryKey: ['private-event-addons'] })
      qc.invalidateQueries({ queryKey: ['addons'] })
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return apiPost<{ imageUrl: string }>('/content/admin/special-booking-addons/upload', fd)
    },
  })

  const columns = [
    {
      title: t('common.image') || 'Image',
      dataIndex: 'imageUrl',
      render: (value?: string | null) =>
        value ? (
          <Image src={resolveFileUrlWithBust(value)} width={56} height={56} style={{ objectFit: 'cover', borderRadius: 6 }} />
        ) : (
          '-'
        ),
    },
    { title: t('common.name') || 'Name', dataIndex: 'name' },
    { title: t('common.price') || 'Price', dataIndex: 'price', render: (value: number) => Number(value).toFixed(2) },
    { title: t('addons.default_qty') || 'Default Qty', dataIndex: 'defaultQuantity' },
    {
      title: t('common.active') || 'Active',
      dataIndex: 'isActive',
      render: (value: boolean) => (value ? t('common.yes') || 'Yes' : t('common.no') || 'No'),
    },
    {
      title: t('addons.branch') || 'Branch',
      dataIndex: 'branchId',
      render: (value?: string) => {
        if (!value) return '-'
        const branch = branches?.find(item => item.id === value)
        return branch ? (branch.name_ar || branch.name_en || value) : value
      },
    },
    {
      title: t('common.actions') || 'Actions',
      render: (_: unknown, row: Addon) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setEditing(row)
              setOpen(true)
              form.setFieldsValue({
                ...row,
                colors: (row.metadata?.colors as BalloonColor[] | undefined) || [],
              })
            }}
          >
            {t('common.edit') || 'Edit'}
          </Button>
          <Button
            size="small"
            danger
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(row.id)}
          >
            {t('common.delete') || 'Delete'}
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
      <Card
        title={t('privateEventAddons.title') || 'Private Booking Add-ons'}
        extra={
          <Space>
            <Select
              allowClear
              placeholder={t('common.active') || 'Active'}
              style={{ width: 160 }}
              onChange={value => setFilters(prev => ({ ...prev, isActive: value }))}
              options={[
                { value: true, label: t('common.active') || 'Active' },
                { value: false, label: t('common.inactive') || 'Inactive' },
              ]}
            />
            <Select
              allowClear
              showSearch
              placeholder={t('addons.branch') || 'Branch'}
              style={{ width: 240 }}
              options={branchOptions}
              onChange={value => setFilters(prev => ({ ...prev, branchId: value || undefined }))}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
            <Button
              type="primary"
              onClick={() => {
                setEditing(null)
                form.resetFields()
                setOpen(true)
              }}
            >
              {t('privateEventAddons.new') || 'New Private Booking Add-on'}
            </Button>
          </Space>
        }
      >
        <Table rowKey="id" loading={isLoading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={
          editing
            ? (t('privateEventAddons.edit_title') || 'Edit Private Booking Add-on')
            : (t('privateEventAddons.create_title') || 'Create Private Booking Add-on')
        }
        open={open}
        onCancel={() => {
          setOpen(false)
          setEditing(null)
        }}
        onOk={() => form.submit()}
        okText={editing ? (t('common.update') || 'Update') : (t('common.create') || 'Create')}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ isActive: true, defaultQuantity: 1 }}
          onFinish={(values: AddonFormValues) => {
            const { colors: rawColors, ...rest } = values
            const colors = Array.isArray(rawColors)
              ? rawColors
                  .filter(color => color && String(color.name || '').trim())
                  .map(color => ({
                    name: String(color.name || '').trim(),
                    hex: String(color.hex || '#000000'),
                  }))
              : []
            const metadata = {
              ...(editing?.metadata || {}),
              ...(rest.metadata || {}),
              privateEventAddon: true,
              colors,
            }
            const body: Partial<Addon> = {
              name: rest.name,
              category: rest.category,
              description: rest.description ?? null,
              imageUrl: rest.imageUrl ?? null,
              price: Number(rest.price),
              defaultQuantity: rest.defaultQuantity,
              isActive: rest.isActive,
              branchId: rest.branchId,
              metadata,
            }
            if (editing) updateMutation.mutate({ id: editing.id, body })
            else createMutation.mutate(body)
          }}
        >
          <Form.Item name="name" label={t('common.name') || 'Name'} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label={t('common.description') || 'Description'}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label={t('common.image') || 'Image'}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item noStyle shouldUpdate={(prev, cur) => prev.imageUrl !== cur.imageUrl}>
                {() => {
                  const url = form.getFieldValue('imageUrl')
                  return url ? (
                    <Image
                      src={resolveFileUrlWithBust(url)}
                      width={160}
                      height={120}
                      style={{ objectFit: 'cover', borderRadius: 8 }}
                    />
                  ) : null
                }}
              </Form.Item>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={file => {
                  uploadMutation.mutate(file, {
                    onSuccess: res => {
                      form.setFieldsValue({ imageUrl: res.imageUrl })
                      message.success(t('common.uploaded') || 'Uploaded')
                    },
                    onError: () => message.error(t('common.upload_failed') || 'Upload failed'),
                  })
                  return false
                }}
              >
                <Button icon={<UploadOutlined />} loading={uploadMutation.isPending}>
                  {t('common.upload_image') || 'Upload Image'}
                </Button>
              </Upload>
              <Form.Item name="imageUrl" hidden>
                <Input />
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="price" label={t('common.price') || 'Price'} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={0.5} />
          </Form.Item>
          <Form.Item
            label={t('privateEventAddons.balloon_colors') || 'Balloon colors (optional)'}
            tooltip={
              t('privateEventAddons.balloon_colors_hint') ||
              'These colors are shown to the customer when picking a balloon add-on'
            }
          >
            <Form.List name="colors">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {fields.map(field => (
                    <Space key={field.key} align="baseline">
                      <Form.Item
                        name={[field.name, 'name']}
                        rules={[{ required: true, message: t('privateEventAddons.color_name') || 'Color name' }]}
                        noStyle
                      >
                        <Input
                          placeholder={t('privateEventAddons.color_name') || 'Color name'}
                          style={{ width: 200 }}
                        />
                      </Form.Item>
                      <Form.Item name={[field.name, 'hex']} noStyle initialValue="#ff0000">
                        <Input type="color" style={{ width: 56, padding: 2 }} />
                      </Form.Item>
                      <Button danger size="small" onClick={() => remove(field.name)}>
                        {t('common.delete') || 'Delete'}
                      </Button>
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ hex: '#ff0000' })} block>
                    + {t('privateEventAddons.add_color') || 'Add color'}
                  </Button>
                </Space>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item name="defaultQuantity" label={t('addons.default_qty') || 'Default Quantity'}>
            <InputNumber style={{ width: '100%' }} min={1} step={1} />
          </Form.Item>
          <Form.Item name="isActive" label={t('common.active') || 'Active'} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="branchId" label={t('addons.branch') || 'Branch'}>
            <Select
              allowClear
              showSearch
              placeholder={t('privateEventAddons.select_branch') || 'Select branch (branches with private bookings enabled)'}
              options={branchOptions}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
