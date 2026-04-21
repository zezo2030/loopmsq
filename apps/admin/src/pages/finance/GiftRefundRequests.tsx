import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Input, message, Modal, Select, Space, Table, Tag } from 'antd'
import { apiGet, apiPost } from '../../api'
import { useTranslation } from 'react-i18next'

type RefundStatus = 'pending' | 'approved' | 'rejected'

type GiftRefundRequest = {
  id: string
  giftType: 'offer' | 'subscription'
  giftStatus: string
  paymentStatus: string
  refundRequestStatus: RefundStatus
  refundRequestedAt?: string | null
  refundRequestReason?: string | null
  refundReviewedAt?: string | null
  refundReviewNote?: string | null
  branchName?: string
  senderName?: string | null
  senderUserId: string
  recipientPhoneMasked?: string | null
  sourceProductTitle: string
  total: number
  currency: string
  createdAt: string
}

type GiftRefundRequestsResponse = {
  items: GiftRefundRequest[]
  total: number
  page: number
  limit: number
}

export default function GiftRefundRequests() {
  const { t } = useTranslation()
  const tt = (key: string, fallback: string) => t(key, { defaultValue: fallback })
  const qc = useQueryClient()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<RefundStatus | undefined>('pending')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [selected, setSelected] = useState<GiftRefundRequest | null>(null)
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null)
  const [note, setNote] = useState('')

  const queryKey = useMemo(
    () => ['gift-refund-requests', { query, status, page, limit }],
    [query, status, page, limit],
  )

  const { data, isLoading } = useQuery<GiftRefundRequestsResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (query.trim()) params.set('query', query.trim())
      if (status) params.set('status', status)
      params.set('page', String(page))
      params.set('limit', String(limit))
      return apiGet<GiftRefundRequestsResponse>(`/gift-orders/admin/refund-requests?${params.toString()}`)
    },
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['gift-refund-requests'] })

  const approveMutation = useMutation({
    mutationFn: (payload: { id: string; note?: string }) =>
      apiPost(`/gift-orders/admin/${payload.id}/refund-approve`, { note: payload.note }),
    onSuccess: () => {
      message.success(tt('giftRefunds.approved', 'تمت الموافقة على الاسترجاع'))
      setDecision(null)
      setSelected(null)
      setNote('')
      refresh()
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (payload: { id: string; note?: string }) =>
      apiPost(`/gift-orders/admin/${payload.id}/refund-reject`, { note: payload.note }),
    onSuccess: () => {
      message.success(tt('giftRefunds.rejected', 'تم رفض طلب الاسترجاع'))
      setDecision(null)
      setSelected(null)
      setNote('')
      refresh()
    },
  })

  const statusTag = (value: string) => {
    const colorMap: Record<string, string> = {
      pending: 'orange',
      approved: 'green',
      rejected: 'red',
      paid: 'blue',
      refunded: 'purple',
      pending_claim: 'gold',
      cancelled: 'red',
      claimed: 'green',
    }
    return (
      <Tag color={colorMap[value] || 'default'}>
        {t(`giftRefunds.status_${value}`, { defaultValue: value })}
      </Tag>
    )
  }

  return (
    <Card
      title={tt('giftRefunds.title', 'طلبات استرجاع الهدايا')}
      extra={<Button onClick={refresh}>{tt('common.refresh', 'تحديث')}</Button>}
    >
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <Input
          style={{ width: 320 }}
          value={query}
          onChange={(e) => {
            setPage(1)
            setQuery(e.target.value)
          }}
          placeholder={tt('giftRefunds.search_placeholder', 'ابحث بالمرسل أو جوال المستلم أو المنتج')}
          allowClear
        />
        <Select
          allowClear
          style={{ width: 220 }}
          value={status}
          onChange={(value) => {
            setPage(1)
            setStatus(value)
          }}
          placeholder={tt('giftRefunds.filter_status', 'تصفية حسب حالة الاسترجاع')}
          options={[
            { value: 'pending', label: tt('giftRefunds.status_pending', 'معلق') },
            { value: 'approved', label: tt('giftRefunds.status_approved', 'موافق عليه') },
            { value: 'rejected', label: tt('giftRefunds.status_rejected', 'مرفوض') },
          ]}
        />
      </Space>

      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data?.items || []}
        columns={[
          {
            title: tt('giftRefunds.sender', 'المرسل'),
            render: (_: unknown, row: GiftRefundRequest) => row.senderName || row.senderUserId,
          },
          {
            title: tt('giftRefunds.product', 'المنتج'),
            dataIndex: 'sourceProductTitle',
          },
          {
            title: tt('giftRefunds.branch', 'الفرع'),
            dataIndex: 'branchName',
          },
          {
            title: tt('giftRefunds.recipient', 'المستلم'),
            dataIndex: 'recipientPhoneMasked',
          },
          {
            title: tt('giftRefunds.amount', 'المبلغ'),
            render: (_: unknown, row: GiftRefundRequest) => `${row.total} ${row.currency}`,
          },
          {
            title: tt('giftRefunds.refund_status', 'حالة الاسترجاع'),
            dataIndex: 'refundRequestStatus',
            render: (value: string) => statusTag(value),
          },
          {
            title: tt('giftRefunds.gift_status', 'حالة الهدية'),
            dataIndex: 'giftStatus',
            render: (value: string) => statusTag(value),
          },
          {
            title: tt('giftRefunds.requested_at', 'تاريخ الطلب'),
            dataIndex: 'refundRequestedAt',
            render: (value?: string | null) => (value ? new Date(value).toLocaleString() : '-'),
          },
          {
            title: tt('giftRefunds.reason', 'السبب'),
            dataIndex: 'refundRequestReason',
            render: (value?: string | null) => value || '-',
          },
          {
            title: tt('giftRefunds.actions', 'الإجراءات'),
            render: (_: unknown, row: GiftRefundRequest) =>
              row.refundRequestStatus === 'pending' ? (
                <Space>
                  <Button
                    type="primary"
                    onClick={() => {
                      setSelected(row)
                      setDecision('approve')
                      setNote('')
                    }}
                  >
                    {tt('giftRefunds.approve', 'موافقة')}
                  </Button>
                  <Button
                    danger
                    onClick={() => {
                      setSelected(row)
                      setDecision('reject')
                      setNote('')
                    }}
                  >
                    {tt('giftRefunds.reject', 'رفض')}
                  </Button>
                </Space>
              ) : (
                <span>{row.refundReviewNote || '-'}</span>
              ),
          },
        ] as any}
        pagination={{
          current: data?.page || page,
          pageSize: data?.limit || limit,
          total: data?.total || 0,
          showSizeChanger: true,
          onChange: (nextPage, nextLimit) => {
            setPage(nextPage)
            setLimit(nextLimit)
          },
        }}
      />

      <Modal
        open={!!selected && !!decision}
        title={
          decision === 'approve'
            ? tt('giftRefunds.approve_title', 'الموافقة على طلب الاسترجاع')
            : tt('giftRefunds.reject_title', 'رفض طلب الاسترجاع')
        }
        onCancel={() => {
          setSelected(null)
          setDecision(null)
          setNote('')
        }}
        onOk={() => {
          if (!selected || !decision) return
          if (decision === 'approve') {
            approveMutation.mutate({ id: selected.id, note: note || undefined })
            return
          }
          rejectMutation.mutate({ id: selected.id, note: note || undefined })
        }}
        confirmLoading={approveMutation.isPending || rejectMutation.isPending}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>{selected?.sourceProductTitle}</div>
          <Input.TextArea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tt('giftRefunds.note_placeholder', 'ملاحظة إدارية اختيارية')}
          />
        </Space>
      </Modal>
    </Card>
  )
}
