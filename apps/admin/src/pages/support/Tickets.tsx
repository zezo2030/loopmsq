import { useEffect, useState } from 'react'
import { Card, Table, Tag, Space, Input, Select, Button, Modal, Form, message } from 'antd'
import { apiGet, apiPost } from '../../api'
import { useTranslation } from 'react-i18next'

type Ticket = {
  id: string
  userId: string
  subject: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  createdAt: string
}

export default function Tickets() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<string>('')
  const [priority, setPriority] = useState<string>('')
  const [assignModal, setAssignModal] = useState<{ open: boolean; id?: string }>({ open: false })
  const [form] = Form.useForm()

  async function load() {
    setLoading(true)
    try {
      const res = await apiGet<any>('/support?page=1&limit=50')
      setRows(res.items || res.tickets || [])
    } catch (e: any) {
      message.error(e?.message || 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = rows.filter(t => {
    const mq = !query || t.subject.toLowerCase().includes(query.toLowerCase()) || t.userId.includes(query)
    const ms = !status || t.status === status
    const mp = !priority || t.priority === priority
    return mq && ms && mp
  })

  const columns = [
    { title: 'Subject', dataIndex: 'subject', key: 'subject' },
    { title: 'User', dataIndex: 'userId', key: 'userId' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Priority', dataIndex: 'priority', key: 'priority', render: (p: string) => <Tag color={{ low: 'default', medium: 'gold', high: 'orange', urgent: 'red' }[p] || 'default'}>{p}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={{ open: 'processing', in_progress: 'blue', resolved: 'green', closed: 'default' }[s] || 'default'}>{s.replace('_',' ')}</Tag> },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt' },
    { title: 'Actions', key: 'actions', render: (_: any, r: Ticket) => (
      <Space>
        <Button size="small" onClick={() => setAssignModal({ open: true, id: r.id })}>Assign/Status</Button>
      </Space>
    ) },
  ]

  return (
    <div className="page-container" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
      <Card title={t('support.tickets') || 'Support Tickets'}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder={t('support.search_placeholder') || 'Search by subject/user'} value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 320 }} />
        <Select placeholder={t('support.status') || 'Status'} value={status} onChange={setStatus} allowClear style={{ width: 160 }} options={[
          { value: 'open', label: t('support.open') || 'Open' },
          { value: 'in_progress', label: t('support.in_progress') || 'In Progress' },
          { value: 'resolved', label: t('support.resolved') || 'Resolved' },
          { value: 'closed', label: t('support.closed') || 'Closed' },
        ]} />
        <Select placeholder={t('support.priority') || 'Priority'} value={priority} onChange={setPriority} allowClear style={{ width: 160 }} options={[
          { value: 'low', label: t('support.low') || 'Low' },
          { value: 'medium', label: t('support.medium') || 'Medium' },
          { value: 'high', label: t('support.high') || 'High' },
          { value: 'urgent', label: t('support.urgent') || 'Urgent' },
        ]} />
        <Button onClick={load}>{t('common.refresh') || 'Refresh'}</Button>
      </Space>
      <Table rowKey="id" loading={loading} dataSource={filtered} columns={columns as any} pagination={{ pageSize: 20 }} />

      <Modal
        title={t('support.assign_update') || 'Assign / Update Status'}
        open={assignModal.open}
        onCancel={() => setAssignModal({ open: false })}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={async (values) => {
          try {
            await apiPost(`/support/${assignModal.id}/reply`, { message: values.message || '' })
            if (values.status || values.priority || values.assignTo) {
              await apiPost(`/support/${assignModal.id}`, { status: values.status, priority: values.priority, assignTo: values.assignTo })
            }
            message.success('Updated')
            setAssignModal({ open: false })
            form.resetFields()
            load()
          } catch (e: any) {
            message.error(e?.message || 'Failed')
          }
        }}>
          <Form.Item name="message" label={t('support.reply_message') || 'Reply Message'}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="assignTo" label={t('support.assign_to_user') || 'Assign To (User ID)'}>
            <Input />
          </Form.Item>
          <Form.Item name="status" label={t('support.status') || 'Status'}>
            <Select allowClear options={[
              { value: 'open', label: t('support.open') || 'Open' },
              { value: 'in_progress', label: t('support.in_progress') || 'In Progress' },
              { value: 'resolved', label: t('support.resolved') || 'Resolved' },
              { value: 'closed', label: t('support.closed') || 'Closed' },
            ]} />
          </Form.Item>
          <Form.Item name="priority" label={t('support.priority') || 'Priority'}>
            <Select allowClear options={[
              { value: 'low', label: t('support.low') || 'Low' },
              { value: 'medium', label: t('support.medium') || 'Medium' },
              { value: 'high', label: t('support.high') || 'High' },
              { value: 'urgent', label: t('support.urgent') || 'Urgent' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
      </Card>
    </div>
  )
}


