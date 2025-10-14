import { useMemo, useState } from 'react'
import { Card, Table, Input, Space, Button, Modal, Form, InputNumber, message } from 'antd'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api'

interface WalletItem {
  id: string
  userId: string
  balance: number
  loyaltyPoints: number
  totalEarned: number
  totalSpent: number
  lastTransactionAt?: string
}

interface WalletsResponse {
  items: WalletItem[]
  total: number
  page: number
  pageSize: number
}

export default function WalletsList() {
  const [query, setQuery] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [adjustUserId, setAdjustUserId] = useState<string | null>(null)
  const [form] = Form.useForm()

  const queryKey = useMemo(() => ['wallets', { query, page, pageSize }], [query, page, pageSize])
  const { data, isLoading, refetch } = useQuery<WalletsResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (query) params.set('query', query)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      return apiGet<WalletsResponse>(`/loyalty/wallets?${params.toString()}`)
    },
  })

  const adjustMutation = useMutation({
    mutationFn: async (payload: { userId: string; balanceDelta?: number; pointsDelta?: number; reason?: string }) => {
      return apiPost(`/loyalty/wallets/${payload.userId}/adjust`, { balanceDelta: payload.balanceDelta, pointsDelta: payload.pointsDelta, reason: payload.reason })
    },
    onSuccess: () => {
      message.success('Wallet adjusted successfully')
      setAdjustUserId(null)
      form.resetFields()
      refetch()
    },
  })

  const columns = [
    { title: 'User ID', dataIndex: 'userId', key: 'userId' },
    { title: 'Balance', dataIndex: 'balance', key: 'balance' },
    { title: 'Points', dataIndex: 'loyaltyPoints', key: 'loyaltyPoints' },
    { title: 'Total Earned', dataIndex: 'totalEarned', key: 'totalEarned' },
    { title: 'Total Spent', dataIndex: 'totalSpent', key: 'totalSpent' },
    { title: 'Last Tx', dataIndex: 'lastTransactionAt', key: 'lastTransactionAt' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, r: WalletItem) => <Button onClick={() => setAdjustUserId(r.userId)}>Adjust</Button>,
    },
  ]

  return (
    <Card title="Wallets" extra={<Button onClick={() => refetch()}>Refresh</Button>}>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="Search userId or name" style={{ width: 320 }} value={query} onChange={(e) => { setPage(1); setQuery(e.target.value) }} />
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns as any}
        dataSource={data?.items || []}
        pagination={{
          current: data?.page || page,
          pageSize: data?.pageSize || pageSize,
          total: data?.total || 0,
          showSizeChanger: true,
          onChange: (p, ps) => { setPage(p); setPageSize(ps) },
        }}
      />

      <Modal
        title="Adjust Wallet"
        open={!!adjustUserId}
        onCancel={() => { setAdjustUserId(null); form.resetFields() }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={(values) => adjustMutation.mutate({ userId: adjustUserId!, ...values })}>
          <Form.Item name="balanceDelta" label="Balance Delta">
            <InputNumber style={{ width: '100%' }} placeholder="e.g. 25 or -10" />
          </Form.Item>
          <Form.Item name="pointsDelta" label="Points Delta">
            <InputNumber style={{ width: '100%' }} placeholder="e.g. 100 or -50" />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <Input placeholder="Reason for adjustment" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
