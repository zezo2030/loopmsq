import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, message, DatePicker, Select, Row, Col, Statistic, Modal } from 'antd'
import { EyeOutlined, CloseOutlined, CalendarOutlined, FilterOutlined } from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'
import { apiGet, apiPost } from '../../api'
import { useBranchAuth } from '../../auth'
import BookingDetail from './BookingDetail'

const { RangePicker } = DatePicker
const { Option } = Select

export default function BookingsList() {
  const { t } = useTranslation()
  const { me } = useBranchAuth()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<any>(null)
  const [isDetailVisible, setIsDetailVisible] = useState(false)
  const [filters, setFilters] = useState({
    dateRange: null as any,
    status: null,
  })
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })

  useEffect(() => {
    loadBookings()
  }, [filters, pagination.current, pagination.pageSize])

  const loadBookings = async () => {
    if (!me?.branchId) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.current.toString(),
        limit: pagination.pageSize.toString(),
      })

      if (filters.dateRange) {
        params.append('from', filters.dateRange[0].toISOString())
        params.append('to', filters.dateRange[1].toISOString())
      }

      if (filters.status) {
        params.append('status', filters.status)
      }

      const data = await apiGet(`/bookings/branch/me?${params.toString()}`)
      const items = Array.isArray(data) ? data : (data?.bookings || [])
      setBookings(items)
      setPagination(prev => ({ ...prev, total: data?.total || items.length }))
    } catch (error) {
      message.error(t('bookings.load_failed') || 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = (booking: any) => {
    setSelectedBooking(booking)
    setIsDetailVisible(true)
  }

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await apiPost(`/bookings/${bookingId}/cancel`, {})
      message.success(t('bookings.cancelled') || 'Booking cancelled successfully')
      loadBookings()
    } catch (error) {
      message.error(t('bookings.cancel_failed') || 'Failed to cancel booking')
    }
  }

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, current: 1 }))
  }

  const handleTableChange = (pagination: any) => {
    setPagination(prev => ({
      ...prev,
      current: pagination.current,
      pageSize: pagination.pageSize,
    }))
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'orange',
      confirmed: 'green',
      cancelled: 'red',
      completed: 'blue',
    }
    return colors[status] || 'default'
  }

  const columns = [
    {
      title: t('bookings.id') || 'Booking ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => `#${id.slice(0, 8)}...`,
    },
    {
      title: t('bookings.user') || 'User',
      key: 'user',
      render: (record: any) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.user?.name || t('bookings.unnamed_user') || 'Unnamed User'}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.user?.email}</div>
        </div>
      ),
    },
    {
      title: t('bookings.hall') || 'Hall',
      key: 'hall',
      render: (record: any) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.hall?.nameAr || record.hall?.nameEn}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.hall?.branch?.nameAr}</div>
        </div>
      ),
    },
    {
      title: t('bookings.start_time') || 'Start Time',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (time: string) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: t('bookings.end_time') || 'End Time',
      dataIndex: 'endTime',
      key: 'endTime',
      render: (time: string) => time ? new Date(time).toLocaleString() : '-',
    },
    {
      title: t('bookings.status') || 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {t(`bookings.status_${status}`) || status}
        </Tag>
      ),
    },
    {
      title: t('bookings.amount') || 'Amount',
      key: 'amount',
      render: (record: any) => `${record.amount || 0} SAR`,
    },
    {
      title: t('common.actions') || 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space>
          <Button 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          >
            {t('common.view_details') || 'View'}
          </Button>
          {record.status === 'confirmed' && (
            <Button 
              size="small" 
              danger
              icon={<CloseOutlined />}
              onClick={() => handleCancelBooking(record.id)}
            >
              {t('bookings.cancel') || 'Cancel'}
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const stats = [
    {
      title: t('bookings.total_bookings') || 'Total Bookings',
      value: pagination.total,
      color: '#3b82f6',
    },
    {
      title: t('bookings.confirmed_bookings') || 'Confirmed',
      value: bookings.filter(b => b.status === 'confirmed').length,
      color: '#10b981',
    },
    {
      title: t('bookings.pending_bookings') || 'Pending',
      value: bookings.filter(b => b.status === 'pending').length,
      color: '#f59e0b',
    },
    {
      title: t('bookings.cancelled_bookings') || 'Cancelled',
      value: bookings.filter(b => b.status === 'cancelled').length,
      color: '#ef4444',
    },
  ]

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">{t('bookings.title') || 'Bookings Management'}</h1>
            <p className="page-subtitle">{t('bookings.subtitle') || 'Manage your branch bookings and reservations'}</p>
          </div>
          <Space>
            <Button icon={<CalendarOutlined />}>
              {t('bookings.calendar_view') || 'Calendar View'}
            </Button>
          </Space>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          {/* Stats Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            {stats.map((stat, index) => (
              <Col xs={12} sm={6} key={index}>
                <Card className="custom-card">
                  <Statistic
                    title={stat.title}
                    value={stat.value}
                    valueStyle={{ color: stat.color, fontSize: '24px', fontWeight: 'bold' }}
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Filters */}
          <Card className="custom-card" style={{ marginBottom: '24px' }}>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={8}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                  {t('bookings.date_range') || 'Date Range'}
                </label>
                <RangePicker 
                  style={{ width: '100%' }}
                  onChange={(dates) => handleFilterChange('dateRange', dates)}
                />
              </Col>
              <Col xs={24} sm={8}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                  {t('bookings.status') || 'Status'}
                </label>
                <Select
                  style={{ width: '100%' }}
                  placeholder={t('bookings.select_status') || 'Select status'}
                  allowClear
                  onChange={(value) => handleFilterChange('status', value)}
                >
                  <Option value="pending">{t('bookings.status_pending') || 'Pending'}</Option>
                  <Option value="confirmed">{t('bookings.status_confirmed') || 'Confirmed'}</Option>
                  <Option value="cancelled">{t('bookings.status_cancelled') || 'Cancelled'}</Option>
                  <Option value="completed">{t('bookings.status_completed') || 'Completed'}</Option>
                </Select>
              </Col>
              <Col xs={24} sm={8}>
                <Button 
                  type="primary" 
                  icon={<FilterOutlined />}
                  onClick={loadBookings}
                  style={{ marginTop: '24px' }}
                >
                  {t('common.apply') || 'Apply Filters'}
                </Button>
              </Col>
            </Row>
          </Card>

          {/* Bookings Table */}
          <Card className="custom-card">
            <Table
              columns={columns}
              dataSource={bookings}
              loading={loading}
              rowKey="id"
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} ${t('common.of') || 'of'} ${total} ${t('bookings.bookings') || 'bookings'}`,
              }}
              onChange={handleTableChange}
              className="custom-table"
            />
          </Card>
        </div>
      </div>

      {/* Booking Detail Modal */}
      <Modal
        title={t('bookings.booking_details') || 'Booking Details'}
        open={isDetailVisible}
        onCancel={() => setIsDetailVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        {selectedBooking && (
          <BookingDetail 
            booking={selectedBooking}
            onClose={() => setIsDetailVisible(false)}
            onCancel={handleCancelBooking}
          />
        )}
      </Modal>
    </div>
  )
}
