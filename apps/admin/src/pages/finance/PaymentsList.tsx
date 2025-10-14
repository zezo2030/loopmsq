import { useMemo, useState, useEffect } from 'react'
import { Card, Table, Tag, Input, Select, DatePicker, Space, Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api'
import dayjs from 'dayjs'
import { Link, useSearchParams } from 'react-router-dom'

interface PaymentItem {
  id: string
  bookingId: string
  amount: number
  currency: string
  status: string
  method: string
  paidAt?: string
  createdAt: string
}

interface PaymentsResponse {
  items: PaymentItem[]
  total: number
  page: number
  pageSize: number
}

const statusColors: Record<string, string> = {
  completed: 'green',
  processing: 'blue',
  pending: 'gold',
  refunded: 'red',
  partially_refunded: 'volcano',
  failed: 'red',
}

export default function PaymentsList() {
  const [status, setStatus] = useState<string | undefined>()
  const [method, setMethod] = useState<string | undefined>()
  const [userId, setUserId] = useState<string>('')
  const [bookingId, setBookingId] = useState<string>('')
  const [from, setFrom] = useState<string | undefined>()
  const [to, setTo] = useState<string | undefined>()
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [searchParams, setSearchParams] = useSearchParams()

  const queryKey = useMemo(() => ['payments', { status, method, userId, bookingId, from, to, page, pageSize }], [status, method, userId, bookingId, from, to, page, pageSize])
  const { data, isLoading, refetch } = useQuery<PaymentsResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (method) params.set('method', method)
      if (userId) params.set('userId', userId)
      if (bookingId) params.set('bookingId', bookingId)
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      return apiGet<PaymentsResponse>(`/payments?${params.toString()}`)
    },
  })

  // Initialize from URL
  useEffect(() => {
    const sp = (k: string) => searchParams.get(k) || undefined
    setStatus(sp('status'))
    setMethod(sp('method'))
    setUserId(searchParams.get('userId') || '')
    setBookingId(searchParams.get('bookingId') || '')
    const f = sp('from'); const t = sp('to')
    setFrom(f); setTo(t)
    const p = Number(searchParams.get('page') || '1')
    const ps = Number(searchParams.get('pageSize') || '20')
    if (!Number.isNaN(p)) setPage(p)
    if (!Number.isNaN(ps)) setPageSize(ps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync to URL
  useEffect(() => {
    const next = new URLSearchParams()
    if (status) next.set('status', status)
    if (method) next.set('method', method)
    if (userId) next.set('userId', userId)
    if (bookingId) next.set('bookingId', bookingId)
    if (from) next.set('from', from)
    if (to) next.set('to', to)
    next.set('page', String(page))
    next.set('pageSize', String(pageSize))
    setSearchParams(next, { replace: true })
  }, [status, method, userId, bookingId, from, to, page, pageSize, setSearchParams])

  const columns = [
    {
      title: 'Payment ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <Link to={`/finance/payments/${id}`}>{id.slice(0, 8)}...</Link>,
    },
    {
      title: 'Booking',
      dataIndex: 'bookingId',
      key: 'bookingId',
      render: (bid: string) => <span>{bid.slice(0, 8)}...</span>,
    },
    {
      title: 'Amount',
      key: 'amount',
      render: (_: any, r: PaymentItem) => `${r.amount} ${r.currency}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
    },
    {
      title: 'Paid At',
      dataIndex: 'paidAt',
      key: 'paidAt',
      render: (d?: string) => (d ? dayjs(d).format('YYYY-MM-DD HH:mm') : '-'),
    },
  ]

  return (
    <Card title="Payments" extra={<Button onClick={() => refetch()}>Refresh</Button>}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder="Status"
          style={{ width: 160 }}
          value={status}
          onChange={(v) => { setPage(1); setStatus(v) }}
          options={[
            { label: 'Pending', value: 'pending' },
            { label: 'Processing', value: 'processing' },
            { label: 'Completed', value: 'completed' },
            { label: 'Failed', value: 'failed' },
            { label: 'Refunded', value: 'refunded' },
            { label: 'Partially Refunded', value: 'partially_refunded' },
          ]}
        />
        <Select
          allowClear
          placeholder="Method"
          style={{ width: 180 }}
          value={method}
          onChange={(v) => { setPage(1); setMethod(v) }}
          options={[
            { label: 'Credit Card', value: 'credit_card' },
            { label: 'Debit Card', value: 'debit_card' },
            { label: 'Wallet', value: 'wallet' },
            { label: 'Bank Transfer', value: 'bank_transfer' },
            { label: 'Cash', value: 'cash' },
          ]}
        />
        <Input placeholder="User ID" style={{ width: 260 }} value={userId} onChange={(e) => setUserId(e.target.value)} />
        <Input placeholder="Booking ID" style={{ width: 260 }} value={bookingId} onChange={(e) => setBookingId(e.target.value)} />
        <DatePicker placeholder="From" onChange={(v) => setFrom(v ? v.toISOString() : undefined)} />
        <DatePicker placeholder="To" onChange={(v) => setTo(v ? v.toISOString() : undefined)} />
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
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
    </Card>
  )
}
