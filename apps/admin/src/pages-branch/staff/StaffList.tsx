import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, message, Modal, Row, Col, Statistic, Switch } from 'antd'
import { PlusOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'
import { apiGet, apiPatch } from '../../shared/api'
import { useAuth } from '../../shared/auth'
import CreateStaff from './CreateStaff'

export default function StaffList() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isCreateVisible, setIsCreateVisible] = useState(false)

  useEffect(() => {
    loadStaff()
  }, [])

  const loadStaff = async () => {
    if (!me?.branchId) return
    
    setLoading(true)
    try {
      const data: any = await apiGet(`/users?role=staff&branchId=${me.branchId}`)
      setStaff(Array.isArray(data) ? data : (data?.users || []))
    } catch (error) {
      message.error(t('staff.load_failed') || 'Failed to load staff')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusToggle = async (staffId: string, currentStatus: boolean) => {
    try {
      const endpoint = currentStatus ? 'deactivate' : 'activate'
      await apiPatch(`/users/${staffId}/${endpoint}`, {})
      message.success(
        endpoint === 'activate' 
          ? (t('staff.activated') || 'Staff activated successfully')
          : (t('staff.deactivated') || 'Staff deactivated successfully')
      )
      loadStaff()
    } catch (error) {
      message.error(
        currentStatus
          ? (t('staff.deactivate_failed') || 'Failed to deactivate staff')
          : (t('staff.activate_failed') || 'Failed to activate staff')
      )
    }
  }

  const handleCreate = () => {
    setIsCreateVisible(true)
  }

  const handleCreateClose = () => {
    setIsCreateVisible(false)
  }

  const handleCreateSuccess = () => {
    handleCreateClose()
    loadStaff()
  }

  const columns = [
    {
      title: t('staff.name') || 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text || t('staff.unnamed') || 'Unnamed Staff'}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.email}</div>
        </div>
      ),
    },
    {
      title: t('staff.phone') || 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone: string) => phone || '-',
    },
    {
      title: t('staff.role') || 'Role',
      dataIndex: 'roles',
      key: 'role',
      render: () => (
        <Tag color="blue">{t('staff.staff') || 'Staff'}</Tag>
      ),
    },
    {
      title: t('staff.status') || 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (isActive: boolean, record: any) => (
        <Switch
          checked={isActive}
          onChange={() => handleStatusToggle(record.id, isActive)}
          checkedChildren={<CheckOutlined />}
          unCheckedChildren={<CloseOutlined />}
        />
      ),
    },
    {
      title: t('staff.joined') || 'Joined',
      dataIndex: 'createdAt',
      key: 'joined',
      render: (date: string) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: t('common.actions') || 'Actions',
      key: 'actions',
      render: () => (
        <Space>
          <Button 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => {
              message.info(t('common.not_implemented') || 'This feature is not available yet')
            }}
          >
            {t('common.edit') || 'Edit'}
          </Button>
        </Space>
      ),
    },
  ]

  const stats = [
    {
      title: t('staff.total_staff') || 'Total Staff',
      value: staff.length,
      color: '#3b82f6',
    },
    {
      title: t('staff.active_staff') || 'Active',
      value: staff.filter(s => s.isActive).length,
      color: '#10b981',
    },
    {
      title: t('staff.inactive_staff') || 'Inactive',
      value: staff.filter(s => !s.isActive).length,
      color: '#ef4444',
    },
  ]

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">{t('staff.title') || 'Staff Management'}</h1>
            <p className="page-subtitle">{t('staff.subtitle') || 'Manage your branch staff members and their access'}</p>
          </div>
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={handleCreate}
              className="btn-primary"
            >
              {t('staff.new') || 'New Staff'}
            </Button>
          </Space>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          {/* Stats Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            {stats.map((stat, index) => (
              <Col xs={12} sm={8} key={index}>
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

          {/* Staff Table */}
          <Card className="custom-card">
            <Table
              columns={columns}
              dataSource={staff}
              loading={loading}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} ${t('common.of') || 'of'} ${total} ${t('staff.staff_members') || 'staff members'}`,
              }}
              className="custom-table"
            />
          </Card>
        </div>
      </div>

      {/* Create Staff Modal */}
      <Modal
        title={t('staff.create_title') || 'Create Staff Member'}
        open={isCreateVisible}
        onCancel={handleCreateClose}
        footer={null}
        width={600}
        destroyOnClose
      >
        <CreateStaff
          onSuccess={handleCreateSuccess}
          onCancel={handleCreateClose}
        />
      </Modal>
    </div>
  )
}


