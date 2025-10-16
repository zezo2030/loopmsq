import { useState } from 'react'
import { Tabs, Input, Table, Space } from 'antd'
import { apiGet } from '../api'

export default function SearchPage() {
  const [q, setQ] = useState('')
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

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 12 }}>
        <Input.Search
          placeholder="Search users, bookings, payments"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onSearch={run}
          enterButton
          loading={loading}
          style={{ width: 420 }}
        />
      </Space>
      <Tabs
        items={[
          {
            key: 'users',
            label: 'Users',
            children: (
              <Table
                size="small"
                rowKey="id"
                dataSource={users}
                columns={[
                  { title: 'ID', dataIndex: 'id' },
                  { title: 'Name', dataIndex: 'name' },
                  { title: 'Email', dataIndex: 'email' },
                  { title: 'Roles', dataIndex: 'roles', render: (v) => (v || []).join(', ') },
                ]}
              />
            ),
          },
          {
            key: 'bookings',
            label: 'Bookings',
            children: (
              <Table
                size="small"
                rowKey="id"
                dataSource={bookings}
                columns={[
                  { title: 'ID', dataIndex: 'id' },
                  { title: 'User', dataIndex: 'userId' },
                  { title: 'Branch', dataIndex: 'branchId' },
                  { title: 'Start', dataIndex: 'startTime' },
                ]}
              />
            ),
          },
          {
            key: 'payments',
            label: 'Payments',
            children: (
              <Table
                size="small"
                rowKey="id"
                dataSource={payments}
                columns={[
                  { title: 'ID', dataIndex: 'id' },
                  { title: 'Amount', dataIndex: 'amount' },
                  { title: 'Method', dataIndex: 'method' },
                  { title: 'Booking', dataIndex: 'bookingId' },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  )
}


