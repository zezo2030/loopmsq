import { useState } from 'react'
import { Card, Table, Button, Select, DatePicker, Tag, message, Space, Row, Col, Statistic } from 'antd'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiPatch } from '../../shared/api'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

import {
  EyeOutlined,
  CloseOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
} from '@ant-design/icons'

import { formatDateTimeAr } from '../../utils/formatDateTimeDisplay'

const { RangePicker } = DatePicker

export default function BookingsList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | [null, null]>([null, null])
  const [status, setStatus] = useState<string | undefined>(undefined)

  const { data, isLoading } = useQuery({
    queryKey: ['branch-bookings', { page, pageSize, dateRange, status }],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (dateRange[0]) params.set('from', dateRange[0]!.toISOString())
      if (dateRange[1]) params.set('to', dateRange[1]!.toISOString())
      if (status) params.set('status', status)
      const res = await apiGet<any>(`/bookings/branch/me?${params.toString()}`)
      return { items: res.bookings || res.items || [], total: res.total || 0 }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => apiPatch(`/bookings/${id}/cancel`, {}),
    onSuccess: () => {
      message.success(t('bookings.cancelled'))
      qc.invalidateQueries({ queryKey: ['branch-bookings'] })
    },
    onError: () => message.error(t('bookings.cancel_failed')),
  })

  const bookings = data?.items || []
  const total = data?.total || 0

  const getStatusColor = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'confirmed': return 'green'
      case 'pending': return 'orange'
      case 'cancelled': return 'red'
      case 'completed': return 'blue'
      default: return 'default'
    }
  }

  const getStatusText = (s: string) => {
    switch (s?.toLowerCase()) {
      case 'confirmed': return t('bookings.status_confirmed')
      case 'pending': return t('bookings.status_pending')
      case 'cancelled': return t('bookings.status_cancelled')
      case 'completed': return t('bookings.status_completed')
      default: return s
    }
  }

  const confirmedCount = bookings.filter((b: { status?: string }) => b.status?.toLowerCase() === 'confirmed').length
  const pendingCount = bookings.filter((b: { status?: string }) => b.status?.toLowerCase() === 'pending').length
  const cancelledCount = bookings.filter((b: { status?: string }) => b.status?.toLowerCase() === 'cancelled').length

  const columns = [
    { title: t('bookings.id'), dataIndex: 'id', key: 'id', render: (v: string) => String(v).slice(0, 8) + '...' },
    { title: t('bookings.user'), dataIndex: 'userId', key: 'userId', render: (v: string, r: any) => r.userName || r.userEmail || v },
    { title: t('bookings.branch_name'), dataIndex: 'branchName', key: 'branchName' },
    { title: t('bookings.start_time'), dataIndex: 'startTime', key: 'startTime', render: (v: string) => v ? formatDateTimeAr(v) : '-' },
    { title: t('bookings.end_time'), dataIndex: 'endTime', key: 'endTime', render: (v: string) => v ? formatDateTimeAr(v) : '-' },
    { title: t('bookings.status'), dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={getStatusColor(v)}>{getStatusText(v)}</Tag> },
    { title: t('bookings.amount'), dataIndex: 'totalAmount', key: 'totalAmount', render: (v: number) => v ? `${v} ${t('common.currency')}` : '-' },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/branch/bookings/${r.id}`)}>
            {t('common.view_details')}
          </Button>
          {r.status?.toLowerCase() === 'pending' && (
            <Button size="small" danger icon={<CloseOutlined />} onClick={() => cancelMutation.mutate(r.id)}>
              {t('bookings.cancel')}
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Statistic
            title={t('bookings.total_bookings')}
            value={total}
            prefix={<CalendarOutlined style={{ color: '#1890ff' }} />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title={t('bookings.confirmed_bookings')}
            value={confirmedCount}
            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title={t('bookings.pending_bookings')}
            value={pendingCount}
            prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title={t('bookings.cancelled_bookings')}
            value={cancelledCount}
            prefix={<StopOutlined style={{ color: '#ff4d' }} />}
          />
        </Col>
      </Row>

      <Card title={t('bookings.title')}>
        <p style={{ color: '#666', marginBottom: 16 }}>{t('bookings.subtitle')}</p>
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker
            placeholder={[t('common.from'), t('common.to')]}
            onChange={(dates) => setDateRange(dates as any)}
            style={{ width: 250 }}
          />
          <Select
            value={status}
            onChange={setStatus}
            placeholder={t('bookings.select_status')}
            style={{ width: 180 }}
            allowClear
            onClear={() => setStatus(undefined)}
          >
            <Select.Option value="pending">{t('bookings.status_pending')}</Select.Option>
            <Select.Option value="confirmed">{t('bookings.status_confirmed')}</Select.Option>
            <Select.Option value="cancelled">{t('bookings.status_cancelled')}</Select.Option>
            <Select.Option value="completed">{t('bookings.status_completed')}</Select.Option>
          </Select>
          <Button onClick={() => { setPage(1); setDateRange([null, null]); setStatus(undefined) }}>
            {t('common.refresh')}
          </Button>
        </Space>

        <Table
          rowKey="id"
          loading={isLoading}
          dataSource={bookings}
          columns={columns as any}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps) },
            showTotal: (total, range) => `${range[0]}-${range[1]} ${t('common.of')} ${total}`,
          }}
        />
      </Card>
    </div>
  )
}
