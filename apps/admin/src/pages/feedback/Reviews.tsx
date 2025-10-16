import { useEffect, useState } from 'react'
import { Card, Table, Tag, Space, Input, Select, message } from 'antd'
import { apiGet } from '../../api'

type Review = {
  id: string
  bookingId: string
  userId: string
  rating: number
  comment?: string
  createdAt: string
}

export default function Reviews() {
  const [rows, setRows] = useState<Review[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [rating, setRating] = useState<string>('')

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        // Assuming an admin listing endpoint exists; otherwise this is placeholder
        const res = await apiGet<any>('/reviews/admin/all?page=1&limit=100')
        setRows(res.items || res.reviews || [])
      } catch (e: any) {
        message.error(e?.message || 'Failed to load reviews')
        setRows([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = rows.filter(r => {
    const matchQ = !query || r.comment?.toLowerCase().includes(query.toLowerCase()) || r.bookingId.includes(query) || r.userId.includes(query)
    const matchRating = !rating || String(r.rating) === rating
    return matchQ && matchRating
  })

  const columns = [
    { title: 'Booking', dataIndex: 'bookingId', key: 'bookingId' },
    { title: 'User', dataIndex: 'userId', key: 'userId' },
    { title: 'Rating', dataIndex: 'rating', key: 'rating', render: (v: number) => <Tag color={v >= 4 ? 'green' : v >= 3 ? 'gold' : 'red'}>{v}★</Tag> },
    { title: 'Comment', dataIndex: 'comment', key: 'comment' },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt' },
  ]

  return (
    <Card title="Reviews">
      <Space style={{ marginBottom: 16 }} wrap>
        <Input placeholder="Search by booking/user/comment" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 320 }} />
        <Select placeholder="Rating" value={rating} onChange={setRating} allowClear style={{ width: 160 }} options={[1,2,3,4,5].map(n => ({ label: `${n}★`, value: String(n) }))} />
      </Space>
      <Table rowKey="id" loading={loading} dataSource={filtered} columns={columns as any} pagination={{ pageSize: 20 }} />
    </Card>
  )
}


