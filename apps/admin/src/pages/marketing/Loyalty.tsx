import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Statistic,
  Switch,
  Table,
  Typography,
  message,
} from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch, apiPost } from '../../api'

const { Text } = Typography

type LoyaltyRule = {
  id: string
  earnRate: number
  pointsPerTicket: number
  isActive: boolean
}

export default function Loyalty() {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [userId, setUserId] = useState('')
  const [editingRule, setEditingRule] = useState<LoyaltyRule | null>(null)
  const queryClient = useQueryClient()

  const rulesQuery = useQuery({
    queryKey: ['loyalty-rules'],
    queryFn: () => apiGet<LoyaltyRule[]>('/loyalty/rules'),
  })

  const userQuery = useQuery({
    queryKey: ['loyalty-user', userId],
    queryFn: () => apiGet<any>(`/loyalty/${userId}`),
    enabled: !!userId,
  })

  const createRule = useMutation({
    mutationFn: (body: Partial<LoyaltyRule>) => apiPost('/loyalty/rules', body),
    onSuccess: () => {
      message.success('Rule created')
      queryClient.invalidateQueries({ queryKey: ['loyalty-rules'] })
      form.resetFields()
    },
  })

  const updateRule = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<LoyaltyRule> }) =>
      apiPatch(`/loyalty/rules/${id}`, body),
    onSuccess: () => {
      message.success('Rule updated')
      queryClient.invalidateQueries({ queryKey: ['loyalty-rules'] })
      setEditingRule(null)
      editForm.resetFields()
    },
  })

  const activateRule = useMutation({
    mutationFn: (id: string) => apiPost(`/loyalty/rules/${id}/activate`, {}),
    onSuccess: () => {
      message.success('Rule activated')
      queryClient.invalidateQueries({ queryKey: ['loyalty-rules'] })
    },
  })

  const activeRule = rulesQuery.data?.find((rule) => rule.isActive)
  const examplePoints = activeRule ? Math.floor(500 * Number(activeRule.earnRate)) : 500

  const columns = [
    {
      title: t('loyalty.earn_rate'),
      dataIndex: 'earnRate',
      key: 'earnRate',
      render: (value: number) => `${Number(value).toFixed(2)} ${t('loyalty.point_per_sar')}`,
    },
    {
      title: t('loyalty.points_per_ticket'),
      dataIndex: 'pointsPerTicket',
      key: 'pointsPerTicket',
      render: (value: number) => `${value} ${t('loyalty.pts')}`,
    },
    {
      title: t('common.active'),
      dataIndex: 'isActive',
      key: 'isActive',
      render: (value: boolean) =>
        value ? <Text type="success">{t('common.yes')}</Text> : <Text type="secondary">{t('common.no')}</Text>,
    },
    {
      title: t('common.actions'),
      key: 'actions',
      render: (_: unknown, rule: LoyaltyRule) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingRule(rule)
              editForm.setFieldsValue(rule)
            }}
          >
            {t('common.edit')}
          </Button>
          {!rule.isActive && (
            <Button size="small" onClick={() => activateRule.mutate(rule.id)}>
              {t('marketing.activate')}
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card title={t('loyalty.program')}>
        {activeRule ? (
          <Card type="inner" title={t('loyalty.current_active_rule')} style={{ marginBottom: 24 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title={t('loyalty.earn_rate')} value={Number(activeRule.earnRate)} suffix={t('loyalty.point_per_sar')} />
              </Col>
              <Col span={8}>
                <Statistic title={t('loyalty.points_per_ticket')} value={activeRule.pointsPerTicket} suffix={t('loyalty.pts')} />
              </Col>
              <Col span={8}>
                <Statistic title={t('loyalty.example')} value={examplePoints} suffix={t('loyalty.pts_from_sar')} />
              </Col>
            </Row>
            <Alert
              style={{ marginTop: 16 }}
              type="info"
              showIcon
              message={t('loyalty.example')}
              description={t('loyalty.example_description', {
                points: examplePoints,
                pointsPerTicket: activeRule.pointsPerTicket,
              })}
            />
          </Card>
        ) : (
          <Alert
            style={{ marginBottom: 24 }}
            type="warning"
            showIcon
            message={t('marketing.no_active_rule')}
          />
        )}

        <Table<LoyaltyRule>
          rowKey="id"
          columns={columns}
          dataSource={rulesQuery.data || []}
          pagination={false}
          loading={rulesQuery.isLoading}
        />

        <Card title={t('loyalty.create_new_rule')} type="inner" style={{ marginTop: 24 }}>
          <Form
            form={form}
            layout="vertical"
            initialValues={{ earnRate: 1, pointsPerTicket: 500, isActive: true }}
            onFinish={(values) => createRule.mutate(values)}
          >
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="earnRate"
                  label={t('loyalty.earn_rate')}
                  rules={[{ required: true, message: t('marketing.earn_rate_required') }]}
                >
                  <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="pointsPerTicket"
                  label={t('loyalty.points_per_ticket')}
                  rules={[{ required: true, message: 'Points per ticket is required' }]}
                >
                  <InputNumber min={1} step={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="isActive" label={t('marketing.activate_immediately')} valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
            <Button type="primary" htmlType="submit" loading={createRule.isPending}>
              {t('loyalty.create_new_rule')}
            </Button>
          </Form>
        </Card>

        <Card title={t('loyalty.user_loyalty_history')} type="inner" style={{ marginTop: 24 }}>
          <Input
            placeholder={t('marketing.enter_user_id')}
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            style={{ maxWidth: 420, marginBottom: 16 }}
          />

          {userQuery.data && (
            <>
              <Descriptions bordered column={3} size="small">
                <Descriptions.Item label={t('loyalty.wallet_balance')}>
                  {userQuery.data.balance} SAR
                </Descriptions.Item>
                <Descriptions.Item label={t('loyalty.total_points')}>
                  {userQuery.data.points} pts
                </Descriptions.Item>
                <Descriptions.Item label={t('loyalty.points_per_ticket')}>
                  {userQuery.data.pointsPerTicket} pts
                </Descriptions.Item>
              </Descriptions>

              <Table
                style={{ marginTop: 16 }}
                rowKey="id"
                dataSource={userQuery.data.transactions || []}
                pagination={false}
                columns={[
                  { title: t('loyalty.transaction_type'), dataIndex: 'type', key: 'type' },
                  { title: t('loyalty.points_change'), dataIndex: 'pointsChange', key: 'pointsChange' },
                  { title: t('loyalty.reason'), dataIndex: 'reason', key: 'reason' },
                  { title: t('loyalty.created_at'), dataIndex: 'createdAt', key: 'createdAt' },
                ]}
              />
            </>
          )}
        </Card>
      </Card>

      <Modal
        open={!!editingRule}
        title={t('marketing.edit_rule')}
        onCancel={() => {
          setEditingRule(null)
          editForm.resetFields()
        }}
        onOk={() => {
          editForm.validateFields().then((values) => {
            if (!editingRule) return
            updateRule.mutate({ id: editingRule.id, body: values })
          })
        }}
        confirmLoading={updateRule.isPending}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="earnRate"
            label={t('loyalty.earn_rate')}
            rules={[{ required: true, message: t('marketing.earn_rate_required') }]}
          >
            <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="pointsPerTicket"
            label={t('loyalty.points_per_ticket')}
            rules={[{ required: true, message: 'Points per ticket is required' }]}
          >
            <InputNumber min={1} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label={t('common.active')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
