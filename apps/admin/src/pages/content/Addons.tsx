import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Switch, Space, message } from 'antd'
import { apiGet, apiPost, apiPut, apiDelete } from '../../api'
import { useTranslation } from 'react-i18next'

type Addon = {
  id: string
  name: string
  price: number
  defaultQuantity: number
  isActive: boolean
  branchId?: string | null
  hallId?: string | null
}

export default function Addons() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Addon | null>(null)
  const [form] = Form.useForm<Partial<Addon>>()
  const [filters, setFilters] = useState<{ branchId?: string; hallId?: string; isActive?: boolean }>({})

  // Load branches and halls for selects
  type Branch = { id: string; name_ar: string; name_en: string }
  type Hall = { id: string; name_ar: string; name_en: string; branchId: string }

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ['branches-select'],
    queryFn: async () => {
      const res = await apiGet<any>('/content/branches?includeInactive=true')
      return Array.isArray(res) ? res : (res.items || res.branches || [])
    },
  })

  const { data: halls } = useQuery<Hall[]>({
    queryKey: ['halls-select'],
    queryFn: async () => {
      const res = await apiGet<any>('/content/halls')
      return Array.isArray(res) ? res : (res.items || res.halls || [])
    },
  })

  const filteredHallsForFilter = useMemo(() => {
    if (!halls) return []
    if (!filters.branchId) return halls
    return halls.filter(h => h.branchId === filters.branchId)
  }, [halls, filters.branchId])

  const branchOptions = useMemo(() => (branches || []).map(b => ({ value: b.id, label: b.name_ar || b.name_en || b.id })), [branches])
  const hallsOptionsAll = useMemo(() => (halls || []).map(h => ({ value: h.id, label: h.name_ar || h.name_en || h.id, branchId: h.branchId })), [halls])
  const hallsOptionsForFilter = useMemo(() => (filteredHallsForFilter || []).map(h => ({ value: h.id, label: h.name_ar || h.name_en || h.id })), [filteredHallsForFilter])

  const { data, isLoading } = useQuery<Addon[]>({
    queryKey: ['addons', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters.branchId) params.set('branchId', filters.branchId)
      if (filters.hallId) params.set('hallId', filters.hallId)
      if (typeof filters.isActive === 'boolean') params.set('isActive', String(filters.isActive))
      return apiGet(`/content/admin/addons${params.toString() ? `?${params}` : ''}`)
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<Addon>) => apiPost('/content/admin/addons', payload),
    onSuccess: () => { message.success(t('common.created') || 'Created'); qc.invalidateQueries({ queryKey: ['addons'] }); setOpen(false); },
  })
  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Addon> }) => apiPut(`/content/admin/addons/${id}`, body),
    onSuccess: () => { message.success(t('common.updated') || 'Updated'); qc.invalidateQueries({ queryKey: ['addons'] }); setOpen(false); setEditing(null); },
  })
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/content/admin/addons/${id}`),
    onSuccess: () => { message.success(t('common.deleted') || 'Deleted'); qc.invalidateQueries({ queryKey: ['addons'] }); },
  })

  const columns = [
    { title: t('common.name') || 'Name', dataIndex: 'name' },
    { title: t('common.price') || 'Price', dataIndex: 'price', render: (v: number) => Number(v).toFixed(2) },
    { title: t('addons.default_qty') || 'Default Qty', dataIndex: 'defaultQuantity' },
    { title: t('common.active') || 'Active', dataIndex: 'isActive', render: (v: boolean) => v ? t('common.yes') || 'Yes' : t('common.no') || 'No' },
    { title: 'Branch', dataIndex: 'branchId', render: (v?: string) => v || '-' },
    { title: 'Hall', dataIndex: 'hallId', render: (v?: string) => v || '-' },
    {
      title: t('common.actions') || 'Actions',
      render: (_: any, row: Addon) => (
        <Space>
          <Button size="small" onClick={() => { setEditing(row); setOpen(true); form.setFieldsValue(row) }}>{t('common.edit') || 'Edit'}</Button>
          <Button size="small" danger loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(row.id)}>{t('common.delete') || 'Delete'}</Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
      <Card
        title={t('addons.title') || 'Add-ons'}
        extra={
          <Space>
            <Select
              allowClear
              placeholder={t('common.active') || 'Active'}
              style={{ width: 160 }}
              onChange={(v) => setFilters(prev => ({ ...prev, isActive: v }))}
              options={[
                { value: true, label: t('common.active') || 'Active' },
                { value: false, label: t('common.inactive') || 'Inactive' },
              ]}
            />
            <Select
              allowClear
              showSearch
              placeholder={t('menu.branch') || 'Branch'}
              style={{ width: 240 }}
              options={branchOptions}
              onChange={(v) => setFilters(prev => ({ ...prev, branchId: v || undefined, hallId: undefined }))}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
            <Select
              allowClear
              showSearch
              placeholder={t('halls.hall') || 'Hall'}
              style={{ width: 240 }}
              options={hallsOptionsForFilter}
              value={filters.hallId}
              onChange={(v) => setFilters(prev => ({ ...prev, hallId: v || undefined }))}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
            <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true) }}>{t('addons.new') || 'New Add-on'}</Button>
          </Space>
        }
      >
        <Table rowKey="id" loading={isLoading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editing ? (t('addons.edit_title') || 'Edit Add-on') : (t('addons.create_title') || 'Create Add-on')}
        open={open}
        onCancel={() => { setOpen(false); setEditing(null) }}
        onOk={() => form.submit()}
        okText={editing ? (t('common.update') || 'Update') : (t('common.create') || 'Create')}
      >
        <Form form={form} layout="vertical" onFinish={(values) => {
          const body = { ...values, price: Number(values.price) }
          if (editing) updateMutation.mutate({ id: editing.id, body })
          else createMutation.mutate(body)
        }}>
          <Form.Item name="name" label={t('common.name') || 'Name'} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="price" label={t('common.price') || 'Price'} rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={0.5} />
          </Form.Item>
          <Form.Item name="defaultQuantity" label={t('addons.default_qty') || 'Default Quantity'}>
            <InputNumber style={{ width: '100%' }} min={1} step={1} />
          </Form.Item>
          <Form.Item name="isActive" label={t('common.active') || 'Active'} valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          {/* Branch select */}
          <Form.Item name="branchId" label={t('menu.branch') || 'Branch'}>
            <Select
              allowClear
              showSearch
              placeholder={t('users.select_branch') || 'Select branch (optional)'}
              options={branchOptions}
              onChange={() => {
                form.setFieldValue('hallId', undefined)
              }}
              filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          {/* Hall select depends on branchId */}
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.branchId !== cur.branchId}>
            {() => {
              const selectedBranchId = form.getFieldValue('branchId') as string | undefined
              const hallOptions = selectedBranchId
                ? hallsOptionsAll.filter(h => h.branchId === selectedBranchId).map(({ value, label }) => ({ value, label }))
                : hallsOptionsAll.map(({ value, label }) => ({ value, label }))
              return (
                <Form.Item name="hallId" label={t('halls.hall') || 'Hall'}>
                  <Select
                    allowClear
                    showSearch
                    placeholder={t('halls.hall') || 'Select hall (optional)'}
                    options={hallOptions}
                    filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                  />
                </Form.Item>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}


