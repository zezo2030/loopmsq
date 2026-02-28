import { useMemo, useState, useEffect } from 'react'
import { Card, Table, Input, Space, Button, Modal, Form, InputNumber, message } from 'antd'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const [query, setQuery] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [adjustUserId, setAdjustUserId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [searchParams, setSearchParams] = useSearchParams()

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

  // Initialize from URL
  useEffect(() => {
    const q = searchParams.get('q') || ''
    const p = Number(searchParams.get('page') || '1')
    const ps = Number(searchParams.get('pageSize') || '20')
    setQuery(q)
    if (!Number.isNaN(p)) setPage(p)
    if (!Number.isNaN(ps)) setPageSize(ps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync to URL
  useEffect(() => {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    next.set('page', String(page))
    next.set('pageSize', String(pageSize))
    setSearchParams(next, { replace: true })
  }, [query, page, pageSize, setSearchParams])

  const adjustMutation = useMutation({
    mutationFn: async (payload: { userId: string; balanceDelta?: number; pointsDelta?: number; reason?: string }) => {
      return apiPost(`/loyalty/wallets/${payload.userId}/adjust`, { balanceDelta: payload.balanceDelta, pointsDelta: payload.pointsDelta, reason: payload.reason })
    },
    onSuccess: () => {
      message.success(t('wallets.adjusted_successfully'))
      setAdjustUserId(null)
      form.resetFields()
      refetch()
    },
  })

  const columns = [
    { title: t('wallets.user_id'), dataIndex: 'userId', key: 'userId' },
    { title: t('wallets.balance'), dataIndex: 'balance', key: 'balance' },
    { title: t('wallets.points'), dataIndex: 'loyaltyPoints', key: 'loyaltyPoints' },
    { title: t('wallets.total_earned'), dataIndex: 'totalEarned', key: 'totalEarned' },
    { title: t('wallets.total_spent'), dataIndex: 'totalSpent', key: 'totalSpent' },
    { title: t('wallets.last_tx'), dataIndex: 'lastTransactionAt', key: 'lastTransactionAt' },
    {
      title: t('wallets.actions'),
      key: 'actions',
      render: (_: any, r: WalletItem) => <Button onClick={() => setAdjustUserId(r.userId)}>{t('wallets.adjust')}</Button>,
    },
  ]

  return (
    <Card title={t('wallets.title')} extra={<Button onClick={() => refetch()}>{t('wallets.refresh')}</Button>}>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder={t('wallets.search_placeholder')} style={{ width: 320 }} value={query} onChange={(e) => { setPage(1); setQuery(e.target.value) }} />
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
        title={t('wallets.adjust_wallet')}
        open={!!adjustUserId}
        onCancel={() => { setAdjustUserId(null); form.resetFields() }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={(values) => adjustMutation.mutate({ userId: adjustUserId!, ...values })}>
          <Form.Item name="balanceDelta" label={t('wallets.balance_delta')}>
            <InputNumber style={{ width: '100%' }} placeholder="e.g. 25 or -10" />
          </Form.Item>
          <Form.Item name="pointsDelta" label={t('wallets.points_delta')}>
            <InputNumber style={{ width: '100%' }} placeholder="e.g. 100 or -50" />
          </Form.Item>
          <Form.Item name="reason" label={t('wallets.reason')}>
            <Input placeholder={t('wallets.reason_placeholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
