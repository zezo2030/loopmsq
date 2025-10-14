import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, DatePicker, Select, Space, Button, message } from 'antd'
import { apiGet } from '../../api'

type Overview = {
  bookings: { total: number; confirmed: number; cancelled: number }
  scans: number
  revenueByMethod: Record<string, number>
}

export default function ReportsOverview() {
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState<string | undefined>()
  const [to, setTo] = useState<string | undefined>()
  const [branchId, setBranchId] = useState<string | undefined>()
  const [data, setData] = useState<Overview | null>(null)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (branchId) params.set('branchId', branchId)
      const res = await apiGet<Overview>(`/reports/overview?${params.toString()}`)
      setData(res)
    } catch (e: any) {
      message.error(e?.message || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <Card title="Reports Overview" loading={loading} extra={<Space>
      <DatePicker placeholder="From" onChange={(v) => setFrom(v ? v.toISOString() : undefined)} />
      <DatePicker placeholder="To" onChange={(v) => setTo(v ? v.toISOString() : undefined)} />
      <Select placeholder="Branch" style={{ width: 200 }} allowClear onChange={(v) => setBranchId(v)} />
      <Button onClick={load}>Apply</Button>
      <Button onClick={async () => {
        try {
          const params = new URLSearchParams()
          if (from) params.set('from', from)
          if (to) params.set('to', to)
          if (branchId) params.set('branchId', branchId)
          const url = `/api/v1/reports/export?type=overview&${params.toString()}`
          window.open(url, '_blank')
        } catch {}
      }}>Export CSV</Button>
    </Space>}>
      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Bookings (Total)" value={data?.bookings.total || 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Bookings (Confirmed)" value={data?.bookings.confirmed || 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Bookings (Cancelled)" value={data?.bookings.cancelled || 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="Scans" value={data?.scans || 0} />
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <Card title="Revenue by Method">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              {Object.entries(data?.revenueByMethod || {}).map(([k, v]) => (
                <Card key={k} size="small"><Statistic title={k} value={v} /></Card>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </Card>
  )
}


