import { useState } from 'react'
import { Card, Table, Select, Tag, Button, Space, Row, Col, Statistic } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BookOutlined, ClockCircleOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { apiGet } from '../../shared/api'
import { formatDateTimeAr } from '../../utils/formatDateTimeDisplay'

type BranchTripRow = {
  id: string
  schoolName: string
  studentsCount: number
  preferredDate: string
  selectedTimeSlot?: string | null
  status: string
  contactPersonName: string
  contactPhone: string
  totalAmount?: number
  quotedPrice?: number
  createdAt: string
}

export default function TripsList() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [status, setStatus] = useState<string | undefined>(undefined)

  const { data, isLoading } = useQuery({
    queryKey: ['branch-trips', { page, pageSize, status }],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageSize))
      if (status) params.set('status', status)
      const res = await apiGet<{ requests: BranchTripRow[]; total: number }>(
        `/trips/branch/me?${params.toString()}`,
      )
      return { items: res.requests || [], total: res.total || 0 }
    },
  })

  const items = data?.items || []
  const total = data?.total || 0
  const pendingCount = items.filter((row) =>
    ['pending', 'under_review', 'approved'].includes(row.status?.toLowerCase()),
  ).length

  const getStatusColor = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'paid':
      case 'completed':
        return 'green'
      case 'pending':
      case 'under_review':
        return 'orange'
      case 'approved':
      case 'invoiced':
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
      title: t('trips.id'),
      dataIndex: 'id',
      key: 'id',
      render: (v: string) => String(v).slice(0, 8) + '...',
    },
    {
      title: t('trips.school_name'),
      dataIndex: 'schoolName',
      key: 'schoolName',
    },
    {
      title: t('trips.students'),
      dataIndex: 'studentsCount',
      key: 'studentsCount',
    },
    {
      title: t('trips.preferred_date'),
      dataIndex: 'preferredDate',
      key: 'preferredDate',
      render: (v: string) => (v ? formatDateTimeAr(v) : '-'),
    },
    {
      title: t('trips.time_slot'),
      dataIndex: 'selectedTimeSlot',
      key: 'selectedTimeSlot',
      render: (v: string) => v || '-',
    },
    {
      title: t('trips.status'),
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={getStatusColor(v)}>{v}</Tag>,
    },
    {
      title: t('trips.contact'),
      key: 'contact',
      render: (_: unknown, r: BranchTripRow) => `${r.contactPersonName} (${r.contactPhone})`,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Statistic
            title={t('menu.schoolTrips')}
            value={total}
            prefix={<BookOutlined style={{ color: '#1890ff' }} />}
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
            title={t('bookings.status_completed')}
            value={items.filter((row) => row.status?.toLowerCase() === 'completed').length}
            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          />
        </Col>
      </Row>

      <Card title={t('menu.schoolTrips')}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            value={status}
            onChange={setStatus}
            placeholder={t('bookings.select_status')}
            style={{ width: 200 }}
            allowClear
            onClear={() => setStatus(undefined)}
          >
            <Select.Option value="pending">{t('bookings.status_pending')}</Select.Option>
            <Select.Option value="under_review">{t('trips.status_under_review')}</Select.Option>
            <Select.Option value="approved">{t('trips.status_approved')}</Select.Option>
            <Select.Option value="paid">{t('trips.status_paid')}</Select.Option>
            <Select.Option value="completed">{t('bookings.status_completed')}</Select.Option>
            <Select.Option value="rejected">{t('events.status_rejected')}</Select.Option>
            <Select.Option value="cancelled">{t('bookings.status_cancelled')}</Select.Option>
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
