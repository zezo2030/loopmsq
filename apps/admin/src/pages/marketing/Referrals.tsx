import { useMemo, useState } from 'react'
import { Card, Tabs, Table, Space, Input, Button, Form, Switch, message } from 'antd'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api'

export default function Referrals() {
  // Codes
  const [codeQuery, setCodeQuery] = useState<{ userId?: string; code?: string; active?: string; page: number; pageSize: number }>({ page: 1, pageSize: 20 })
  const codesKey = useMemo(() => ['ref-codes', codeQuery], [codeQuery])
  const codes = useQuery({
    queryKey: codesKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (codeQuery.userId) params.set('userId', codeQuery.userId)
      if (codeQuery.code) params.set('code', codeQuery.code)
      if (codeQuery.active) params.set('active', codeQuery.active)
      params.set('page', String(codeQuery.page))
      params.set('pageSize', String(codeQuery.pageSize))
      return apiGet<any>(`/referrals/codes?${params.toString()}`)
    },
  })

  const createCode = useMutation({
    mutationFn: (body: any) => apiPost('/referrals/codes', body),
    onSuccess: () => { message.success('Code created/updated'); codes.refetch() },
  })

  // Earnings
  const [earnQuery, setEarnQuery] = useState<{ status?: string; referrerId?: string; page: number; pageSize: number }>({ page: 1, pageSize: 20 })
  const earnsKey = useMemo(() => ['ref-earnings', earnQuery], [earnQuery])
  const earnings = useQuery({
    queryKey: earnsKey,
    queryFn: async () => {
      const params = new URLSearchParams()
      if (earnQuery.status) params.set('status', earnQuery.status)
      if (earnQuery.referrerId) params.set('referrerId', earnQuery.referrerId)
      params.set('page', String(earnQuery.page))
      params.set('pageSize', String(earnQuery.pageSize))
      return apiGet<any>(`/referrals/earnings?${params.toString()}`)
    },
  })

  const approve = useMutation({
    mutationFn: (id: string) => apiPost(`/referrals/earnings/${id}/approve`, {}),
    onSuccess: () => { message.success('Approved'); earnings.refetch() },
  })

  return (
    <Card title="Referrals">
      <Tabs
        items={[
          {
            key: 'codes',
            label: 'Codes',
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space wrap>
                  <Input placeholder="User ID" value={codeQuery.userId} onChange={(e) => setCodeQuery({ ...codeQuery, page: 1, userId: e.target.value })} />
                  <Input placeholder="Code" value={codeQuery.code} onChange={(e) => setCodeQuery({ ...codeQuery, page: 1, code: e.target.value })} />
                  <Switch checkedChildren="Active" unCheckedChildren="Inactive" checked={codeQuery.active === 'true'} onChange={(v) => setCodeQuery({ ...codeQuery, page: 1, active: v ? 'true' : 'false' })} />
                  <Button onClick={() => codes.refetch()}>Search</Button>
                </Space>
                <Form layout="inline" onFinish={(values) => createCode.mutate(values)}>
                  <Form.Item name="userId" rules={[{ required: true, message: 'User ID required' }]}>
                    <Input placeholder="User ID to create code for" />
                  </Form.Item>
                  <Form.Item name="isActive" valuePropName="checked">
                    <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">Create/Update Code</Button>
                  </Form.Item>
                </Form>
                <Table
                  rowKey="id"
                  loading={codes.isLoading}
                  columns={[{ title: 'Code', dataIndex: 'code' }, { title: 'User', dataIndex: 'userId' }, { title: 'Active', dataIndex: 'isActive' }] as any}
                  dataSource={codes.data?.items || []}
                  pagination={{
                    current: codes.data?.page || 1,
                    pageSize: codes.data?.pageSize || 20,
                    total: codes.data?.total || 0,
                    showSizeChanger: true,
                    onChange: (p, ps) => setCodeQuery({ ...codeQuery, page: p, pageSize: ps }),
                  }}
                />
              </Space>
            ),
          },
          {
            key: 'earnings',
            label: 'Earnings',
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Input placeholder="Referrer ID" value={earnQuery.referrerId} onChange={(e) => setEarnQuery({ ...earnQuery, page: 1, referrerId: e.target.value })} />
                  <Input placeholder="Status (pending/approved/rejected)" value={earnQuery.status} onChange={(e) => setEarnQuery({ ...earnQuery, page: 1, status: e.target.value })} />
                  <Button onClick={() => earnings.refetch()}>Search</Button>
                </Space>
                <Table
                  rowKey="id"
                  loading={earnings.isLoading}
                  columns={[
                    { title: 'ID', dataIndex: 'id' },
                    { title: 'Referrer', dataIndex: 'referrerId' },
                    { title: 'Referee', dataIndex: 'refereeId' },
                    { title: 'Amount', dataIndex: 'amount' },
                    { title: 'Status', dataIndex: 'status' },
                    { title: 'Action', key: 'action', render: (_: any, r: any) => r.status === 'pending' ? <Button onClick={() => approve.mutate(r.id)}>Approve</Button> : null },
                  ] as any}
                  dataSource={earnings.data?.items || []}
                  pagination={{
                    current: earnings.data?.page || 1,
                    pageSize: earnings.data?.pageSize || 20,
                    total: earnings.data?.total || 0,
                    showSizeChanger: true,
                    onChange: (p, ps) => setEarnQuery({ ...earnQuery, page: p, pageSize: ps }),
                  }}
                />
              </>
            ),
          },
        ]}
      />
    </Card>
  )
}


