import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, message } from 'antd'
import { apiDelete, apiGet, apiPost, apiPut } from '../../api'
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

type Branch = {
  id: string
  name_ar: string
  name_en: string
  hasEventBookings?: boolean
}

const LEGACY_EVENT_ADDON_CATEGORIES = ['event_private', 'event_balloon', 'event_cake', 'event_decor'] as const

export default function PrivateEventAddons() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Addon | null>(null)
  const [form] = Form.useForm<Partial<Addon>>()
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

      const allAddons = await apiGet(`/content/admin/addons${params.toString() ? `?${params}` : ''}`)
      if (!Array.isArray(allAddons)) return []

      const branchIdsWithEventBookings = new Set((branches || []).map(branch => branch.id))
      return allAddons.filter((addon: Addon) => {
        const belongsToEventBookings =
          addon.metadata?.privateEventAddon === true ||
          LEGACY_EVENT_ADDON_CATEGORIES.includes(addon.category as (typeof LEGACY_EVENT_ADDON_CATEGORIES)[number])
        const branchAllowed = !addon.branchId || branchIdsWithEventBookings.has(addon.branchId)
        return belongsToEventBookings && branchAllowed
      })
    },
    enabled: !!branches,
  })

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Addon>) => apiPost('/content/admin/addons', payload),
    onSuccess: () => {
      message.success(t('common.created') || 'Created')
      qc.invalidateQueries({ queryKey: ['private-event-addons'] })
      qc.invalidateQueries({ queryKey: ['addons'] })
      setOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Addon> }) =>
      apiPut(`/content/admin/addons/${id}`, body),
    onSuccess: () => {
      message.success(t('common.updated') || 'Updated')
      qc.invalidateQueries({ queryKey: ['private-event-addons'] })
      qc.invalidateQueries({ queryKey: ['addons'] })
      setOpen(false)
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/content/admin/addons/${id}`),
    onSuccess: () => {
      message.success(t('common.deleted') || 'Deleted')
      qc.invalidateQueries({ queryKey: ['private-event-addons'] })
      qc.invalidateQueries({ queryKey: ['addons'] })
    },
  })

  const columns = [
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
              form.setFieldsValue(row)
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
          onFinish={values => {
            const metadata = {
              ...(editing?.metadata || {}),
              ...((values.metadata as Record<string, unknown> | undefined) || {}),
              privateEventAddon: true,
            }
            const body = {
              ...values,
              price: Number(values.price),
              metadata,
              imageUrl: null,
              description: null,
            }
            if (editing) updateMutation.mutate({ id: editing.id, body })
            else createMutation.mutate(body)
          }}
        >
          <Form.Item name="name" label={t('common.name') || 'Name'} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="price" label={t('common.price') || 'Price'} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={0.5} />
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
