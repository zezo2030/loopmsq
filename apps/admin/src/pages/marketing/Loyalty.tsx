import { useState } from 'react'
import { Card, Tabs, Form, InputNumber, Switch, Button, Table, Space, Input, message, Descriptions, Alert, Modal, Typography, Divider, Row, Col, Statistic } from 'antd'
import { EditOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch } from '../../api'
import { useTranslation } from 'react-i18next'

const { Text } = Typography

export default function Loyalty() {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [userId, setUserId] = useState<string>('')
  const [editingRule, setEditingRule] = useState<any>(null)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const queryClient = useQueryClient()

  const rulesQuery = useQuery({ queryKey: ['loyalty-rules'], queryFn: () => apiGet<any[]>('/loyalty/rules') })
  const userQuery = useQuery({
    queryKey: ['loyalty-user', userId],
    queryFn: () => apiGet<any>(`/loyalty/${userId}`),
    enabled: !!userId,
  })

  const activeRule = rulesQuery.data?.find((r: any) => r.isActive)

  const createRule = useMutation({
    mutationFn: (body: any) => apiPost('/loyalty/rules', body),
    onSuccess: () => { 
      message.success(t('marketing.rule_created') || 'Rule created successfully'); 
      queryClient.invalidateQueries({ queryKey: ['loyalty-rules'] }); 
      form.resetFields() 
    },
  })

  const updateRule = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => apiPatch(`/loyalty/rules/${id}`, body),
    onSuccess: () => { 
      message.success(t('marketing.rule_updated') || 'Rule updated successfully'); 
      queryClient.invalidateQueries({ queryKey: ['loyalty-rules'] }); 
      setEditModalVisible(false)
      setEditingRule(null)
      editForm.resetFields()
    },
  })

  const activateRule = useMutation({
    mutationFn: (id: string) => apiPost(`/loyalty/rules/${id}/activate`, {}),
    onSuccess: () => { 
      message.success(t('marketing.rule_activated') || 'Rule activated successfully'); 
      queryClient.invalidateQueries({ queryKey: ['loyalty-rules'] }) 
    },
  })

  const handleEdit = (rule: any) => {
    setEditingRule(rule)
    editForm.setFieldsValue({
      earnRate: Number(rule.earnRate),
      redeemRate: Number(rule.redeemRate),
      minRedeemPoints: rule.minRedeemPoints,
      isActive: rule.isActive,
    })
    setEditModalVisible(true)
  }

  const handleEditSubmit = () => {
    editForm.validateFields().then(values => {
      updateRule.mutate({ id: editingRule.id, body: values })
    })
  }

  const calculateExample = (earnRate: number, redeemRate: number) => {
    const paymentAmount = 100
    const pointsEarned = Math.floor(paymentAmount * earnRate)
    const redeemValue = pointsEarned * redeemRate
    return { paymentAmount, pointsEarned, redeemValue }
  }

  const columns = [
    { 
      title: t('marketing.earn_rate') || 'Earn Rate', 
      dataIndex: 'earnRate', 
      key: 'earnRate',
      render: (v: number) => `${(Number(v) * 100).toFixed(2)}% (${Number(v).toFixed(4)})`
    },
    { 
      title: t('marketing.redeem_rate') || 'Redeem Rate', 
      dataIndex: 'redeemRate', 
      key: 'redeemRate',
      render: (v: number) => `${Number(v).toFixed(2)} ${t('marketing.currency_per_point') || 'SAR per point'}`
    },
    { 
      title: t('marketing.min_redeem') || 'Min Redeem', 
      dataIndex: 'minRedeemPoints', 
      key: 'minRedeemPoints',
      render: (v: number) => `${v} ${t('marketing.points') || 'points'}`
    },
    { 
      title: t('marketing.active') || 'Active', 
      dataIndex: 'isActive', 
      key: 'isActive', 
      render: (v: boolean) => (v ? <Text type="success">{t('marketing.yes') || 'Yes'}</Text> : <Text type="secondary">{t('marketing.no') || 'No'}</Text>) 
    },
    { 
      title: t('marketing.actions') || 'Actions', 
      key: 'actions', 
      render: (_: any, r: any) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            size="small" 
            onClick={() => handleEdit(r)}
          >
            {t('marketing.edit') || 'Edit'}
          </Button>
          {!r.isActive && (
            <Button 
              size="small" 
              onClick={() => activateRule.mutate(r.id)}
            >
              {t('marketing.activate') || 'Activate'}
            </Button>
          )}
        </Space>
      ) 
    },
  ]

  const example = activeRule ? calculateExample(Number(activeRule.earnRate), Number(activeRule.redeemRate)) : null

  return (
    <div>
      <Card title={t('marketing.loyalty') || 'Loyalty Program'}>
        {activeRule && (
          <Card 
            type="inner" 
            title={
              <Space>
                <InfoCircleOutlined style={{ color: '#1890ff' }} />
                <Text strong>{t('marketing.current_settings') || 'Current Active Settings'}</Text>
              </Space>
            }
            extra={
              <Button 
                type="primary" 
                icon={<EditOutlined />}
                onClick={() => handleEdit(activeRule)}
              >
                {t('marketing.edit_settings') || 'Edit Settings'}
              </Button>
            }
            style={{ marginBottom: 24 }}
          >
            <Row gutter={24}>
              <Col span={8}>
                <Statistic
                  title={t('marketing.earn_rate') || 'Earn Rate'}
                  value={Number(activeRule.earnRate) * 100}
                  suffix="%"
                  precision={2}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('marketing.earn_rate_desc') || 'Percentage of payment amount converted to points'}
                </Text>
              </Col>
              <Col span={8}>
                <Statistic
                  title={t('marketing.redeem_rate') || 'Redeem Rate'}
                  value={Number(activeRule.redeemRate)}
                  suffix={`${t('marketing.currency') || 'SAR'} / ${t('marketing.point') || 'point'}`}
                  precision={2}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('marketing.redeem_rate_desc') || 'Currency value per loyalty point when redeeming'}
                </Text>
              </Col>
              <Col span={8}>
                <Statistic
                  title={t('marketing.min_redeem_points') || 'Minimum Redeem Points'}
                  value={activeRule.minRedeemPoints}
                  suffix={t('marketing.points') || 'points'}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('marketing.min_redeem_desc') || 'Minimum points required for redemption'}
                </Text>
              </Col>
            </Row>
            
            {example && (
              <>
                <Divider />
                <Alert
                  message={t('marketing.example_calculation') || 'Example Calculation'}
                  description={
                    <div>
                      <Text>
                        {t('marketing.example_payment') || 'If a customer pays'} <Text strong>{example.paymentAmount} {t('marketing.currency') || 'SAR'}</Text>
                        {', '}
                        {t('marketing.they_earn') || 'they will earn'} <Text strong>{example.pointsEarned} {t('marketing.points') || 'points'}</Text>
                        {'. '}
                        {t('marketing.can_redeem') || 'These points can be redeemed for'} <Text strong>{example.redeemValue.toFixed(2)} {t('marketing.currency') || 'SAR'}</Text>
                        {' '}
                        {t('marketing.in_wallet') || 'in their wallet'}
                        {'.'}
                      </Text>
                    </div>
                  }
                  type="info"
                  showIcon
                />
              </>
            )}
          </Card>
        )}

        {!activeRule && (
          <Alert
            message={t('marketing.no_active_rule') || 'No Active Rule'}
            description={t('marketing.no_active_rule_desc') || 'Please create and activate a loyalty rule to start the program.'}
            type="warning"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Tabs
          items={[
            {
              key: 'all',
              label: t('marketing.all_rules') || 'All Rules',
              children: (
                <>
                  <Table 
                    rowKey="id" 
                    columns={columns as any} 
                    dataSource={rulesQuery.data || []} 
                    pagination={false} 
                    loading={rulesQuery.isLoading}
                    style={{ marginBottom: 16 }} 
                  />
                  <Card title={t('marketing.create_new_rule') || 'Create New Rule'} type="inner">
                    <Form 
                      layout="vertical" 
                      form={form} 
                      onFinish={(values) => createRule.mutate(values)}
                    >
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item 
                            name="earnRate" 
                            label={t('marketing.earn_rate') || 'Earn Rate (e.g., 0.05 for 5%)'} 
                            rules={[{ required: true, message: t('marketing.earn_rate_required') || 'Earn rate is required' }]}
                            tooltip={t('marketing.earn_rate_tooltip') || 'Enter the rate as decimal (0.05 = 5%)'}
                          >
                            <InputNumber 
                              step={0.01} 
                              min={0} 
                              max={1} 
                              style={{ width: '100%' }}
                              placeholder="0.05"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item 
                            name="redeemRate" 
                            label={t('marketing.redeem_rate') || 'Redeem Rate (e.g., 1 for 1 SAR per point)'} 
                            rules={[{ required: true, message: t('marketing.redeem_rate_required') || 'Redeem rate is required' }]}
                            tooltip={t('marketing.redeem_rate_tooltip') || 'Enter the currency value per point (1 = 1 SAR per point)'}
                          >
                            <InputNumber 
                              step={0.01} 
                              min={0} 
                              style={{ width: '100%' }}
                              placeholder="1"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={8}>
                          <Form.Item 
                            name="minRedeemPoints" 
                            label={t('marketing.min_redeem_points') || 'Minimum Redeem Points'}
                            tooltip={t('marketing.min_redeem_tooltip') || 'Minimum points required for redemption (0 = no minimum)'}
                          >
                            <InputNumber 
                              min={0} 
                              style={{ width: '100%' }}
                              placeholder="0"
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item 
                        name="isActive" 
                        label={t('marketing.activate_immediately') || 'Activate Immediately'} 
                        valuePropName="checked"
                        tooltip={t('marketing.activate_tooltip') || 'If checked, this rule will be activated and all other rules will be deactivated'}
                      >
                        <Switch />
                      </Form.Item>
                      <Form.Item>
                        <Button type="primary" htmlType="submit" loading={createRule.isPending}>
                          {t('marketing.create_rule') || 'Create Rule'}
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>
                </>
              ),
            },
            {
              key: 'history',
              label: t('marketing.user_history') || 'User History',
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Input 
                    placeholder={t('marketing.enter_user_id') || 'Enter User ID'} 
                    value={userId} 
                    onChange={(e) => setUserId(e.target.value)}
                    style={{ maxWidth: 400 }}
                  />
                  {userId && userQuery.data && (
                    <Card>
                      <Descriptions title={t('marketing.user_wallet_info') || 'User Wallet Information'} bordered column={2}>
                        <Descriptions.Item label={t('marketing.balance') || 'Balance'}>
                          {userQuery.data.balance} {t('marketing.currency') || 'SAR'}
                        </Descriptions.Item>
                        <Descriptions.Item label={t('marketing.points') || 'Points'}>
                          {userQuery.data.points} {t('marketing.points') || 'points'}
                        </Descriptions.Item>
                      </Descriptions>
                      <Divider />
                      <Table
                        rowKey="id"
                        columns={[
                          { title: t('marketing.type') || 'Type', dataIndex: 'type', key: 'type' },
                          { 
                            title: t('marketing.points_change') || 'Points Change', 
                            dataIndex: 'pointsChange', 
                            key: 'pointsChange',
                            render: (v: number) => (
                              <Text type={v > 0 ? 'success' : 'danger'}>
                                {v > 0 ? '+' : ''}{v}
                              </Text>
                            )
                          },
                          { 
                            title: t('marketing.amount_change') || 'Amount Change', 
                            dataIndex: 'amountChange', 
                            key: 'amountChange',
                            render: (v: number) => v ? `${v} ${t('marketing.currency') || 'SAR'}` : '-'
                          },
                          { title: t('marketing.reason') || 'Reason', dataIndex: 'reason', key: 'reason' },
                          { title: t('marketing.created_at') || 'Created At', dataIndex: 'createdAt', key: 'createdAt' },
                        ] as any}
                        dataSource={userQuery.data.transactions || []}
                        pagination={false}
                      />
                    </Card>
                  )}
                  {userId && userQuery.isError && (
                    <Alert
                      message={t('marketing.user_not_found') || 'User not found'}
                      type="error"
                    />
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={t('marketing.edit_rule') || 'Edit Loyalty Rule'}
        open={editModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => {
          setEditModalVisible(false)
          setEditingRule(null)
          editForm.resetFields()
        }}
        okText={t('marketing.save') || 'Save'}
        cancelText={t('marketing.cancel') || 'Cancel'}
        confirmLoading={updateRule.isPending}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item 
            name="earnRate" 
            label={t('marketing.earn_rate') || 'Earn Rate (e.g., 0.05 for 5%)'} 
            rules={[{ required: true, message: t('marketing.earn_rate_required') || 'Earn rate is required' }]}
            tooltip={t('marketing.earn_rate_tooltip') || 'Enter the rate as decimal (0.05 = 5%)'}
          >
            <InputNumber 
              step={0.01} 
              min={0} 
              max={1} 
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item 
            name="redeemRate" 
            label={t('marketing.redeem_rate') || 'Redeem Rate (e.g., 1 for 1 SAR per point)'} 
            rules={[{ required: true, message: t('marketing.redeem_rate_required') || 'Redeem rate is required' }]}
            tooltip={t('marketing.redeem_rate_tooltip') || 'Enter the currency value per point (1 = 1 SAR per point)'}
          >
            <InputNumber 
              step={0.01} 
              min={0} 
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item 
            name="minRedeemPoints" 
            label={t('marketing.min_redeem_points') || 'Minimum Redeem Points'}
            tooltip={t('marketing.min_redeem_tooltip') || 'Minimum points required for redemption (0 = no minimum)'}
          >
            <InputNumber 
              min={0} 
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item 
            name="isActive" 
            label={t('marketing.active') || 'Active'} 
            valuePropName="checked"
            tooltip={t('marketing.activate_tooltip') || 'If checked, this rule will be activated and all other rules will be deactivated'}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
