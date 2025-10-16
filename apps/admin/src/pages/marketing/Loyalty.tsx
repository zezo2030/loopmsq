import { useState } from 'react'
import { Card, Tabs, Form, InputNumber, Switch, Button, Table, Space, Input, message } from 'antd'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api'

export default function Loyalty() {
  const [form] = Form.useForm()
  const [userId, setUserId] = useState<string>('')

  const rulesQuery = useQuery({ queryKey: ['loyalty-rules'], queryFn: () => apiGet<any[]>('/loyalty/rules') })
  const userQuery = useQuery({
    queryKey: ['loyalty-user', userId],
    queryFn: () => apiGet<any>(`/loyalty/${userId}`),
    enabled: !!userId,
  })

  const createRule = useMutation({
    mutationFn: (body: any) => apiPost('/loyalty/rules', body),
    onSuccess: () => { message.success('Rule created'); rulesQuery.refetch(); form.resetFields() },
  })
  const activateRule = useMutation({
    mutationFn: (id: string) => apiPost(`/loyalty/rules/${id}/activate`, {}),
    onSuccess: () => { message.success('Rule activated'); rulesQuery.refetch() },
  })

  const columns = [
    { title: 'Earn Rate', dataIndex: 'earnRate', key: 'earnRate' },
    { title: 'Redeem Rate', dataIndex: 'redeemRate', key: 'redeemRate' },
    { title: 'Min Redeem', dataIndex: 'minRedeemPoints', key: 'minRedeemPoints' },
    { title: 'Active', dataIndex: 'isActive', key: 'isActive', render: (v: boolean) => (v ? 'Yes' : 'No') },
    { title: 'Actions', key: 'actions', render: (_: any, r: any) => !r.isActive ? <Button onClick={() => activateRule.mutate(r.id)}>Activate</Button> : null },
  ]

  return (
    <Card title="Loyalty">
      <Tabs
        items={[
          {
            key: 'active',
            label: 'Active Rule',
            children: (
              <Table rowKey="id" columns={columns as any} dataSource={(rulesQuery.data || []).filter((r: any) => r.isActive)} pagination={false} />
            ),
          },
          {
            key: 'all',
            label: 'All Rules',
            children: (
              <>
                <Table rowKey="id" columns={columns as any} dataSource={rulesQuery.data || []} pagination={false} style={{ marginBottom: 16 }} />
                <Form layout="inline" form={form} onFinish={(values) => createRule.mutate(values)}>
                  <Form.Item name="earnRate" label="Earn Rate" rules={[{ required: true }]}>
                    <InputNumber step={0.01} />
                  </Form.Item>
                  <Form.Item name="redeemRate" label="Redeem Rate" rules={[{ required: true }]}>
                    <InputNumber step={0.01} />
                  </Form.Item>
                  <Form.Item name="minRedeemPoints" label="Min Redeem">
                    <InputNumber />
                  </Form.Item>
                  <Form.Item name="isActive" label="Active" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">Create Rule</Button>
                  </Form.Item>
                </Form>
              </>
            ),
          },
          {
            key: 'history',
            label: 'User History',
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Input placeholder="Enter User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
                {userId && userQuery.data && (
                  <Card>
                    <p>Balance: {userQuery.data.balance}</p>
                    <p>Points: {userQuery.data.points}</p>
                    <Table
                      rowKey="id"
                      columns={[
                        { title: 'Type', dataIndex: 'type', key: 'type' },
                        { title: 'Points Δ', dataIndex: 'pointsChange', key: 'pointsChange' },
                        { title: 'Amount Δ', dataIndex: 'amountChange', key: 'amountChange' },
                        { title: 'Reason', dataIndex: 'reason', key: 'reason' },
                        { title: 'Created At', dataIndex: 'createdAt', key: 'createdAt' },
                      ] as any}
                      dataSource={userQuery.data.transactions}
                      pagination={false}
                    />
                  </Card>
                )}
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}
