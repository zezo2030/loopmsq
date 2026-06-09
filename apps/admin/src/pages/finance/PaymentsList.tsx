import { useMemo, useState, useEffect } from 'react'
import { Card, Table, Tag, Input, Select, DatePicker, Space, Button, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { apiGet } from '../../api'
import { formatDayjsDisplayAr } from '../../utils/formatDateTimeDisplay'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface PaymentItem {
  id: string
  bookingId?: string | null
  eventRequestId?: string | null
  tripRequestId?: string | null
  offerBookingId?: string | null
  subscriptionPurchaseId?: string | null
  giftOrderId?: string | null
  branchId?: string | null
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
  const { t } = useTranslation()
  const [status, setStatus] = useState<string | undefined>()
  const [method, setMethod] = useState<string | undefined>()
  const [userId, setUserId] = useState<string>('')
  const [bookingId, setBookingId] = useState<string>('')
  const [branchId, setBranchId] = useState<string | undefined>()
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])
  const [from, setFrom] = useState<string | undefined>()
  const [to, setTo] = useState<string | undefined>()
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [exporting, setExporting] = useState<boolean>(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const queryKey = useMemo(() => ['payments', { status, method, userId, bookingId, branchId, from, to, page, pageSize }], [status, method, userId, bookingId, branchId, from, to, page, pageSize])
  const { data, isLoading, refetch } = useQuery<PaymentsResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (method) params.set('method', method)
      if (userId) params.set('userId', userId)
      if (bookingId) params.set('bookingId', bookingId)
      if (branchId) params.set('branchId', branchId)
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
    setBranchId(sp('branchId'))
    const f = sp('from'); const t = sp('to')
    setFrom(f); setTo(t)
    const p = Number(searchParams.get('page') || '1')
    const ps = Number(searchParams.get('pageSize') || '20')
    if (!Number.isNaN(p)) setPage(p)
    if (!Number.isNaN(ps)) setPageSize(ps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load branches list once
  useEffect(() => {
    (async () => {
      try {
        const resp = await apiGet<Array<{ id: string; name_en?: string; name_ar?: string }>>('/content/branches')
        setBranches((resp || []).map(b => ({ id: b.id, name: (b as any).name_ar || (b as any).name_en || 'Branch' })))
      } catch {}
    })()
  }, [])

  // Sync to URL
  useEffect(() => {
    const next = new URLSearchParams()
    if (status) next.set('status', status)
    if (method) next.set('method', method)
    if (userId) next.set('userId', userId)
    if (bookingId) next.set('bookingId', bookingId)
    if (branchId) next.set('branchId', branchId)
    if (from) next.set('from', from)
    if (to) next.set('to', to)
    next.set('page', String(page))
    next.set('pageSize', String(pageSize))
    setSearchParams(next, { replace: true })
  }, [status, method, userId, bookingId, branchId, from, to, page, pageSize, setSearchParams])

  const columns = [
    {
      title: t('payments.id') || 'Payment ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => id ? <Link to={`/admin/finance/payments/${id}`}>{id.slice(0, 8)}...</Link> : '-',
    },
    {
      title: t('payments.reference') || 'Reference',
      key: 'reference',
      render: (_: any, r: PaymentItem) => {
        const refs: Array<{ label: string; id: string }> = []
        if (r.bookingId) refs.push({ label: t('payments.ref_booking') || 'Booking', id: r.bookingId })
        if (r.eventRequestId) refs.push({ label: t('payments.ref_event') || 'Event', id: r.eventRequestId })
        if (r.tripRequestId) refs.push({ label: t('payments.ref_trip') || 'Trip', id: r.tripRequestId })
        if (r.offerBookingId) refs.push({ label: t('payments.ref_offer') || 'Offer', id: r.offerBookingId })
        if (r.subscriptionPurchaseId) refs.push({ label: t('payments.ref_subscription') || 'Subscription', id: r.subscriptionPurchaseId })
        if (r.giftOrderId) refs.push({ label: t('payments.ref_gift') || 'Gift', id: r.giftOrderId })
        if (refs.length === 0) return '-'
        return (
          <span>
            {refs.map((x, i) => (
              <span key={i}>
                <Tag>{x.label}</Tag>
                <span style={{ marginInlineEnd: 8 }}>{x.id.slice(0, 8)}...</span>
              </span>
            ))}
          </span>
        )
      },
    },
    {
      title: t('payments.branch') || 'Branch',
      dataIndex: 'branchId',
      key: 'branchId',
      render: (bid?: string | null) => {
        if (!bid) return '-'
        const b = branches.find(x => x.id === bid)
        return b?.name || bid.slice(0, 8) + '...'
      },
    },
    {
      title: t('payments.amount') || 'Amount',
      key: 'amount',
      render: (_: any, r: PaymentItem) => `${r.amount} ${r.currency}`,
    },
    {
      title: t('payments.status') || 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
    },
    {
      title: t('payments.method') || 'Method',
      dataIndex: 'method',
      key: 'method',
    },
    {
      title: t('payments.paid_at') || 'Paid At',
      dataIndex: 'paidAt',
      key: 'paidAt',
      render: (d?: string) => (d ? formatDayjsDisplayAr(d) : '-'),
    },
  ]

  const referenceText = (r: PaymentItem) => {
    const refs: string[] = []
    if (r.bookingId) refs.push(`${t('payments.ref_booking') || 'Booking'}: ${r.bookingId}`)
    if (r.eventRequestId) refs.push(`${t('payments.ref_event') || 'Event'}: ${r.eventRequestId}`)
    if (r.tripRequestId) refs.push(`${t('payments.ref_trip') || 'Trip'}: ${r.tripRequestId}`)
    if (r.offerBookingId) refs.push(`${t('payments.ref_offer') || 'Offer'}: ${r.offerBookingId}`)
    if (r.subscriptionPurchaseId) refs.push(`${t('payments.ref_subscription') || 'Subscription'}: ${r.subscriptionPurchaseId}`)
    if (r.giftOrderId) refs.push(`${t('payments.ref_gift') || 'Gift'}: ${r.giftOrderId}`)
    return refs.length ? refs.join(' | ') : '-'
  }

  const exportToExcel = async () => {
    setExporting(true)
    try {
      // Fetch all pages matching the current filters (API caps pageSize at 100)
      const all: PaymentItem[] = []
      let p = 1
      const ps = 100
      for (;;) {
        const params = new URLSearchParams()
        if (status) params.set('status', status)
        if (method) params.set('method', method)
        if (userId) params.set('userId', userId)
        if (bookingId) params.set('bookingId', bookingId)
        if (branchId) params.set('branchId', branchId)
        if (from) params.set('from', from)
        if (to) params.set('to', to)
        params.set('page', String(p))
        params.set('pageSize', String(ps))
        const resp = await apiGet<PaymentsResponse>(`/payments?${params.toString()}`)
        all.push(...(resp.items || []))
        if (all.length >= resp.total || (resp.items || []).length === 0 || p >= 200) break
        p += 1
      }

      const headers = {
        id: t('payments.id') || 'Payment ID',
        reference: t('payments.reference') || 'Reference',
        branch: t('payments.branch') || 'Branch',
        amount: t('payments.amount') || 'Amount',
        status: t('payments.status') || 'Status',
        method: t('payments.method') || 'Method',
        paidAt: t('payments.paid_at') || 'Paid At',
      }
      const rows = all.map(r => ({
        [headers.id]: r.id,
        [headers.reference]: referenceText(r),
        [headers.branch]: r.branchId ? (branches.find(x => x.id === r.branchId)?.name || r.branchId) : '-',
        [headers.amount]: `${r.amount} ${r.currency}`,
        [headers.status]: t(`payments.status_${r.status}`) || r.status,
        [headers.method]: t(`payments.method_${r.method}`) || r.method,
        [headers.paidAt]: r.paidAt ? formatDayjsDisplayAr(r.paidAt) : '-',
      }))

      const ws = XLSX.utils.json_to_sheet(rows, { header: Object.values(headers) })
      ws['!cols'] = [
        { wch: 38 }, // id
        { wch: 50 }, // reference
        { wch: 22 }, // branch
        { wch: 14 }, // amount
        { wch: 14 }, // status
        { wch: 16 }, // method
        { wch: 22 }, // paidAt
      ]
      const wb = XLSX.utils.book_new()
      wb.Workbook = { Views: [{ RTL: true }] }
      XLSX.utils.book_append_sheet(wb, ws, t('payments.payments') || 'Payments')
      const today = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `payments_${today}.xlsx`)
      message.success(t('payments.export_done') || 'تم التصدير بنجاح')
    } catch {
      message.error(t('payments.export_failed') || 'تعذّر التصدير')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page-container" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
      <Card
        title={t('payments.title') || 'Payments'}
        extra={
          <Space>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={exportToExcel}>
              {t('payments.export_excel') || 'تصدير إكسل'}
            </Button>
            <Button onClick={() => refetch()}>{t('common.refresh') || 'Refresh'}</Button>
          </Space>
        }
      >
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('payments.select_branch') || 'اختر الفرع'}
          style={{ width: 220 }}
          value={branchId}
          onChange={(v) => { setPage(1); setBranchId(v) }}
          options={branches.map(b => ({ label: b.name, value: b.id }))}
        />
        <Select
          allowClear
          placeholder={t('payments.status') || 'Status'}
          style={{ width: 160 }}
          value={status}
          onChange={(v) => { setPage(1); setStatus(v) }}
          options={[
            { label: t('payments.status_pending') || 'Pending', value: 'pending' },
            { label: t('payments.status_processing') || 'Processing', value: 'processing' },
            { label: t('payments.status_completed') || 'Completed', value: 'completed' },
            { label: t('payments.status_failed') || 'Failed', value: 'failed' },
            { label: t('payments.status_refunded') || 'Refunded', value: 'refunded' },
            { label: t('payments.status_partially_refunded') || 'Partially Refunded', value: 'partially_refunded' },
          ]}
        />
        <Select
          allowClear
          placeholder={t('payments.method') || 'Method'}
          style={{ width: 180 }}
          value={method}
          onChange={(v) => { setPage(1); setMethod(v) }}
          options={[
            { label: t('payments.method_credit_card') || 'Credit Card', value: 'credit_card' },
            { label: t('payments.method_debit_card') || 'Debit Card', value: 'debit_card' },
            { label: t('payments.method_wallet') || 'Wallet', value: 'wallet' },
            { label: t('payments.method_bank_transfer') || 'Bank Transfer', value: 'bank_transfer' },
            { label: t('payments.method_cash') || 'Cash', value: 'cash' },
          ]}
        />
        <Input placeholder={t('payments.user_id') || 'User ID'} style={{ width: 260 }} value={userId} onChange={(e) => setUserId(e.target.value)} />
        <Input placeholder={t('payments.booking_id') || 'Booking ID'} style={{ width: 260 }} value={bookingId} onChange={(e) => setBookingId(e.target.value)} />
        <DatePicker placeholder={t('common.from') || 'From'} onChange={(v) => setFrom(v ? v.toISOString() : undefined)} />
        <DatePicker placeholder={t('common.to') || 'To'} onChange={(v) => setTo(v ? v.toISOString() : undefined)} />
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
    </div>
  )
}
