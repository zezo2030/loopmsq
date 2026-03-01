import { useState } from 'react'
import { Tabs, Input, Table, Space } from 'antd'
import { UserOutlined, CalendarOutlined, CreditCardOutlined } from '@ant-design/icons'
import { apiGet } from '../api'
import { useTranslation } from 'react-i18next'

export default function SearchPage() {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [activeTab, setActiveTab] = useState<'users' | 'bookings' | 'payments'>('users')
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [bookings, setBookings] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])

  const run = async () => {
    setLoading(true)
    try {
      const [u, b, p] = await Promise.all([
        apiGet<any>(`/search/users?q=${encodeURIComponent(q)}`),
        apiGet<any>(`/search/bookings?q=${encodeURIComponent(q)}`),
        apiGet<any>(`/search/payments?q=${encodeURIComponent(q)}`),
      ])
      setUsers(u.items || [])
      setBookings(b.items || [])
      setPayments(p.items || [])
    } finally {
      setLoading(false)
    }
  }
  const tabLabelStyle = (isActive: boolean) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 12,
    border: `1px solid ${isActive ? '#1677ff' : '#d9d9d9'}`,
    background: isActive ? 'rgba(22,119,255,0.10)' : '#fff',
    color: isActive ? '#1677ff' : 'rgba(0,0,0,0.85)',
    fontWeight: 600,
    transition: 'all 0.2s ease',
  })
  const tabMetaStyle = { display: 'flex', flexDirection: 'column' as const, lineHeight: 1.2 }
  const tabSubTextStyle = { fontSize: 12, color: 'rgba(0,0,0,0.45)', fontWeight: 400 }

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder={t('search.placeholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onSearch={run}
          enterButton={t('search.button')}
          loading={loading}
          style={{ width: 420 }}
        />
      </Space>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'users' | 'bookings' | 'payments')}
        tabBarStyle={{ marginBottom: 20, borderBottom: 'none' }}
        items={[
          {
            key: 'users',
            label: (
              <div style={tabLabelStyle(activeTab === 'users')}>
                <UserOutlined />
                <div style={tabMetaStyle}>
                  <span>{t('search.users')}</span>
                  <span style={tabSubTextStyle}>{users.length} {t('search.results')}</span>
                </div>
              </div>
            ),
            children: (
              <Table
                size="small"
                rowKey="id"
                dataSource={users}
                columns={[
                  { title: t('users.user_id'), dataIndex: 'id' },
                  { title: t('common.name'), dataIndex: 'name' },
                  { title: t('users.email_address'), dataIndex: 'email' },
                  { title: t('users.roles'), dataIndex: 'roles', render: (v) => (v || []).join(', ') },
                ]}
              />
            ),
          },
          {
            key: 'bookings',
            label: (
              <div style={tabLabelStyle(activeTab === 'bookings')}>
                <CalendarOutlined />
                <div style={tabMetaStyle}>
                  <span>{t('search.bookings')}</span>
                  <span style={tabSubTextStyle}>{bookings.length} {t('search.results')}</span>
                </div>
              </div>
            ),
            children: (
              <Table
                size="small"
                rowKey="id"
                dataSource={bookings}
                columns={[
                  { title: t('bookings.id'), dataIndex: 'id' },
                  { title: t('bookings.user'), dataIndex: 'userId' },
                  { title: t('reports.branch'), dataIndex: 'branchId' },
                  { title: t('search.start_time'), dataIndex: 'startTime' },
                ]}
              />
            ),
          },
          {
            key: 'payments',
            label: (
              <div style={tabLabelStyle(activeTab === 'payments')}>
                <CreditCardOutlined />
                <div style={tabMetaStyle}>
                  <span>{t('search.payments')}</span>
                  <span style={tabSubTextStyle}>{payments.length} {t('search.results')}</span>
                </div>
              </div>
            ),
            children: (
              <Table
                size="small"
                rowKey="id"
                dataSource={payments}
                columns={[
                  { title: t('payments.id'), dataIndex: 'id' },
                  { title: t('payments.amount'), dataIndex: 'amount' },
                  { title: t('payments.method'), dataIndex: 'method' },
                  { title: t('payments.booking'), dataIndex: 'bookingId' },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  )
}


