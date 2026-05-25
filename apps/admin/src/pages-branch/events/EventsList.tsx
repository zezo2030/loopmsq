import { useState } from 'react'
import { Card, Table, Select, Tag, Button, Space, Row, Col, Statistic, Popconfirm, message } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { GiftOutlined, ClockCircleOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { apiGet, apiPost } from '../../shared/api'
import { formatDateTimeAr } from '../../utils/formatDateTimeDisplay'

type BranchEventRow = {
  id: string
  type: string
  status: string
  customerName: string
  customerPhone?: string | null
  startTime: string
  persons: number
  totalAmount: number
  depositAmount?: number
  amountPaid?: number
  refundDueAmount?: number
  paymentOption?: string | null
  createdAt: string
}

async function cancelEvent(id: string, onDone: () => void) {
  try {
    const result = await apiPost<{ refundDueAmount?: number }>(
      `/events/requests/${id}/cancel`,
      {},
    )
    const refund = Number(result?.refundDueAmount ?? 0)
    if (refund > 0) {
      message.success(`تم الإلغاء. مستحق الاسترداد: ${refund} ر.س`)
    } else {
      message.success('تم إلغاء الحجز')
    }
    onDone()
  } catch (e: any) {
    message.error(e?.message || 'فشل الإلغاء')
  }
}

export default function EventsList() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [status, setStatus] = useState<string | undefined>(undefined)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['branch-events', { page, pageSize, status }],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageSize))
      if (status) params.set('status', status)
      const res = await apiGet<{ data: BranchEventRow[]; total: number }>(
        `/events/branch/me?${params.toString()}`,
      )
      return { items: res.data || [], total: res.total || 0 }
    },
  })

  const items = data?.items || []
  const total = data?.total || 0
  const pendingCount = items.filter((e) =>
    ['submitted', 'under_review', 'quoted'].includes(e.status?.toLowerCase()),
  ).length

  const getStatusColor = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'confirmed':
      case 'paid':
      case 'deposit_paid':
        return 'green'
      case 'submitted':
      case 'under_review':
        return 'orange'
      case 'quoted':
        return 'blue'
      case 'rejected':
      case 'cancelled':
        return 'red'
      default:
        return 'default'
    }
  }

  const columns = [
    {
      title: t('events.id'),
      dataIndex: 'id',
      key: 'id',
      render: (v: string) => String(v).slice(0, 8) + '...',
    },
    {
      title: t('events.customer'),
      dataIndex: 'customerName',
      key: 'customerName',
    },
    {
      title: t('events.type'),
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: t('events.start_time'),
      dataIndex: 'startTime',
      key: 'startTime',
      render: (v: string) => (v ? formatDateTimeAr(v) : '-'),
    },
    {
      title: t('events.persons'),
      dataIndex: 'persons',
      key: 'persons',
    },
    {
      title: t('events.status'),
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag>,
    },
    {
      title: t('events.amount'),
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (v: number) => (v ? `${v} ${t('common.currency')}` : '-'),
    },
    {
      title: t('events.amount_paid'),
      dataIndex: 'amountPaid',
      key: 'amountPaid',
      render: (v: number, row: BranchEventRow) => {
        const paid = Number(v ?? 0)
        if (paid > 0) return `${paid} ${t('common.currency')}`
        if (row.status === 'cancelled' && Number(row.refundDueAmount ?? 0) > 0) {
          return <Tag color="orange">استرداد: {row.refundDueAmount}</Tag>
        }
        return '-'
      },
    },
    {
      title: t('common.actions') || 'إجراءات',
      key: 'actions',
      render: (_: unknown, row: BranchEventRow) =>
        !['cancelled', 'rejected'].includes(row.status?.toLowerCase()) ? (
          <Popconfirm
            title="إلغاء الحجز؟"
            description={
              Number(row.amountPaid ?? 0) > 0
                ? `مبلغ مستحق الاسترداد: ${row.amountPaid} ر.س`
                : undefined
            }
            onConfirm={() => cancelEvent(row.id, () => refetch())}
            okText="نعم"
            cancelText="لا"
          >
            <Button type="link" danger size="small">
              إلغاء
            </Button>
          </Popconfirm>
        ) : null,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Statistic
            title={t('menu.privateBookings')}
            value={total}
            prefix={<GiftOutlined style={{ color: '#1890ff' }} />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={t('dashboard.pending_approvals')}
            value={pendingCount}
            prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={t('bookings.status_confirmed')}
            value={items.filter((e) => ['confirmed', 'paid'].includes(e.status?.toLowerCase())).length}
            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          />
        </Col>
      </Row>

      <Card title={t('menu.privateBookings')}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            value={status}
            onChange={setStatus}
            placeholder={t('bookings.select_status')}
            style={{ width: 200 }}
            allowClear
            onClear={() => setStatus(undefined)}
          >
            <Select.Option value="submitted">{t('events.status_submitted')}</Select.Option>
            <Select.Option value="under_review">{t('events.status_under_review')}</Select.Option>
            <Select.Option value="quoted">{t('events.status_quoted')}</Select.Option>
            <Select.Option value="confirmed">{t('bookings.status_confirmed')}</Select.Option>
            <Select.Option value="paid">{t('events.status_paid')}</Select.Option>
            <Select.Option value="rejected">{t('events.status_rejected')}</Select.Option>
            <Select.Option value="cancelled">{t('events.status_cancelled')}</Select.Option>
          </Select>
          <Button onClick={() => { setPage(1); setStatus(undefined) }}>{t('common.refresh')}</Button>
        </Space>

        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={items}
          columns={columns}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>
    </div>
  )
}
