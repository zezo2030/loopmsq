import { useMemo, useState } from 'react'
import { Card, Tabs, Table, Space, Input, Button, Form, Switch, message, Tag, Row, Col, Select } from 'antd'
import { SearchOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, UserOutlined, DollarOutlined, CodeOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api'
import { useTranslation } from 'react-i18next'

export default function Referrals() {
  const { t } = useTranslation()
  
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
    onSuccess: () => { 
      message.success(t('referrals.code_created_updated'))
      codes.refetch()
    },
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
    onSuccess: () => { 
      message.success(t('referrals.approved'))
      earnings.refetch() 
    },
  })

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      pending: { color: 'orange', label: t('referrals.pending') },
      approved: { color: 'green', label: t('referrals.approved_status') },
      rejected: { color: 'red', label: t('referrals.rejected') },
    }
    const statusInfo = statusMap[status] || { color: 'default', label: status }
    return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
  }

  return (
    <div className="page-container" style={{ padding: '24px' }}>
      <Card 
        title={
          <Space>
            <UserOutlined />
            <span>{t('referrals.title')}</span>
          </Space>
        }
        style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
      >
        <Tabs
          className="referrals-tabs"
          items={[
            {
              key: 'codes',
              label: (
                <Space>
                  <CodeOutlined />
                  <span>{t('referrals.codes')}</span>
                </Space>
              ),
              children: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {/* Search Filters */}
                  <Card 
                    title={t('referrals.filter_by_user')}
                    size="small"
                    style={{ backgroundColor: '#fafafa' }}
                  >
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12} md={8}>
                        <Input 
                          prefix={<UserOutlined />}
                          placeholder={t('referrals.user_id_placeholder')}
                          value={codeQuery.userId} 
                          onChange={(e) => setCodeQuery({ ...codeQuery, page: 1, userId: e.target.value })} 
                          allowClear
                        />
                      </Col>
                      <Col xs={24} sm={12} md={8}>
                        <Input 
                          prefix={<CodeOutlined />}
                          placeholder={t('referrals.code_placeholder')}
                          value={codeQuery.code} 
                          onChange={(e) => setCodeQuery({ ...codeQuery, page: 1, code: e.target.value })} 
                          allowClear
                        />
                      </Col>
                      <Col xs={24} sm={12} md={8}>
                        <Space>
                          <Switch 
                            checkedChildren={<CheckCircleOutlined />}
                            unCheckedChildren={<CloseCircleOutlined />}
                            checked={codeQuery.active === 'true'} 
                            onChange={(v) => setCodeQuery({ ...codeQuery, page: 1, active: v ? 'true' : 'false' })} 
                          />
                          <span>{codeQuery.active === 'true' ? t('referrals.active') : t('referrals.inactive')}</span>
                        </Space>
                      </Col>
                      <Col xs={24}>
                        <Button 
                          type="primary" 
                          icon={<SearchOutlined />}
                          onClick={() => codes.refetch()}
                          style={{ width: '100%' }}
                        >
                          {t('referrals.search')}
                        </Button>
                      </Col>
                    </Row>
                  </Card>

                  {/* Create Code Form */}
                  <Card 
                    title={
                      <Space>
                        <PlusOutlined />
                        <span>{t('referrals.create_update_code')}</span>
                      </Space>
                    }
                    size="small"
                    style={{ backgroundColor: '#f0f9ff', border: '1px solid #91d5ff' }}
                  >
                    <Form 
                      layout="vertical" 
                      onFinish={(values) => createCode.mutate(values)}
                      style={{ marginTop: '16px' }}
                    >
                      <Row gutter={16}>
                        <Col xs={24} sm={12} md={8}>
                          <Form.Item 
                            name="userId" 
                            label={t('referrals.user_id')}
                            rules={[{ required: true, message: t('referrals.user_id_required') }]}
                          >
                            <Input 
                              prefix={<UserOutlined />}
                              placeholder={t('referrals.user_id_to_create')} 
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12} md={8}>
                          <Form.Item 
                            name="isActive" 
                            label={t('referrals.active')}
                            valuePropName="checked"
                            initialValue={true}
                          >
                            <Switch 
                              checkedChildren={<CheckCircleOutlined />}
                              unCheckedChildren={<CloseCircleOutlined />}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={24} md={8}>
                          <Form.Item label=" " style={{ marginBottom: 0 }}>
                            <Button 
                              type="primary" 
                              htmlType="submit" 
                              icon={<PlusOutlined />}
                              loading={createCode.isPending}
                              block
                            >
                              {t('referrals.create_update_code')}
                            </Button>
                          </Form.Item>
                        </Col>
                      </Row>
                    </Form>
                  </Card>

                  {/* Codes Table */}
                  <Card>
                    <Table
                      rowKey="id"
                      loading={codes.isLoading}
                      columns={[
                        { 
                          title: t('referrals.code'), 
                          dataIndex: 'code',
                          render: (code: string) => (
                            <Tag color="blue" style={{ fontSize: '14px', padding: '4px 12px' }}>
                              <CodeOutlined /> {code}
                            </Tag>
                          )
                        }, 
                        { 
                          title: t('referrals.user'), 
                          dataIndex: 'userId',
                          render: (userId: string) => (
                            <Space>
                              <UserOutlined />
                              <span>{userId}</span>
                            </Space>
                          )
                        }, 
                        { 
                          title: t('referrals.active'), 
                          dataIndex: 'isActive',
                          render: (isActive: boolean) => (
                            <Tag color={isActive ? 'green' : 'red'} icon={isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
                              {isActive ? t('referrals.active') : t('referrals.inactive')}
                            </Tag>
                          )
                        },
                        {
                          title: t('referrals.created_at'),
                          dataIndex: 'createdAt',
                          render: (date: string) => date ? new Date(date).toLocaleDateString('ar-SA', { calendar: 'gregory' }) : '-'
                        }
                      ] as any}
                      dataSource={codes.data?.items || []}
                      pagination={{
                        current: codes.data?.page || 1,
                        pageSize: codes.data?.pageSize || 20,
                        total: codes.data?.total || 0,
                        showSizeChanger: true,
                        showTotal: (total) => `${t('common.of')} ${total}`,
                        onChange: (p, ps) => setCodeQuery({ ...codeQuery, page: p, pageSize: ps }),
                      }}
                    />
                  </Card>
                </Space>
              ),
            },
            {
              key: 'earnings',
              label: (
                <Space>
                  <DollarOutlined />
                  <span>{t('referrals.earnings')}</span>
                </Space>
              ),
              children: (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {/* Search Filters */}
                  <Card 
                    title={t('referrals.filter_by_status')}
                    size="small"
                    style={{ backgroundColor: '#fafafa' }}
                  >
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12} md={8}>
                        <Input 
                          prefix={<UserOutlined />}
                          placeholder={t('referrals.referrer_id')}
                          value={earnQuery.referrerId} 
                          onChange={(e) => setEarnQuery({ ...earnQuery, page: 1, referrerId: e.target.value })} 
                          allowClear
                        />
                      </Col>
                      <Col xs={24} sm={12} md={8}>
                        <Select
                          placeholder={t('referrals.status_placeholder')}
                          style={{ width: '100%' }}
                          value={earnQuery.status}
                          onChange={(v) => setEarnQuery({ ...earnQuery, page: 1, status: v })}
                          allowClear
                        >
                          <Select.Option value="pending">{t('referrals.pending')}</Select.Option>
                          <Select.Option value="approved">{t('referrals.approved_status')}</Select.Option>
                          <Select.Option value="rejected">{t('referrals.rejected')}</Select.Option>
                        </Select>
                      </Col>
                      <Col xs={24}>
                        <Button 
                          type="primary" 
                          icon={<SearchOutlined />}
                          onClick={() => earnings.refetch()}
                          style={{ width: '100%' }}
                        >
                          {t('referrals.search')}
                        </Button>
                      </Col>
                    </Row>
                  </Card>

                  {/* Earnings Table */}
                  <Card>
                    <Table
                      rowKey="id"
                      loading={earnings.isLoading}
                      columns={[
                        { 
                          title: 'ID', 
                          dataIndex: 'id',
                          render: (id: string) => <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{id.slice(0, 8)}...</span>
                        },
                        { 
                          title: t('referrals.referrer'), 
                          dataIndex: 'referrerId',
                          render: (referrerId: string) => (
                            <Space>
                              <UserOutlined />
                              <span>{referrerId}</span>
                            </Space>
                          )
                        },
                        { 
                          title: t('referrals.referee'), 
                          dataIndex: 'refereeId',
                          render: (refereeId: string) => (
                            <Space>
                              <UserOutlined />
                              <span>{refereeId}</span>
                            </Space>
                          )
                        },
                        { 
                          title: t('referrals.amount'), 
                          dataIndex: 'amount',
                          render: (amount: number) => (
                            <Tag color="green" icon={<DollarOutlined />} style={{ fontSize: '14px', fontWeight: 'bold' }}>
                              {Number(amount).toFixed(2)} {t('common.currency')}
                            </Tag>
                          )
                        },
                        { 
                          title: t('referrals.status'), 
                          dataIndex: 'status',
                          render: (status: string) => getStatusTag(status)
                        },
                        { 
                          title: t('referrals.action'), 
                          key: 'action', 
                          render: (_: any, r: any) => 
                            r.status === 'pending' ? (
                              <Button 
                                type="primary" 
                                icon={<CheckCircleOutlined />}
                                onClick={() => approve.mutate(r.id)}
                                loading={approve.isPending}
                              >
                                {t('referrals.approve')}
                              </Button>
                            ) : null 
                        },
                      ] as any}
                      dataSource={earnings.data?.items || []}
                      pagination={{
                        current: earnings.data?.page || 1,
                        pageSize: earnings.data?.pageSize || 20,
                        total: earnings.data?.total || 0,
                        showSizeChanger: true,
                        showTotal: (total) => `${t('common.of')} ${total}`,
                        onChange: (p, ps) => setEarnQuery({ ...earnQuery, page: p, pageSize: ps }),
                      }}
                    />
                  </Card>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}


