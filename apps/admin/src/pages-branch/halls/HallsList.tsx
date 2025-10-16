import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Tag, message, Modal, Row, Col, Statistic } from 'antd'
import { PlusOutlined, EditOutlined, EyeOutlined, SettingOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'
import { apiGet, apiPatch, apiDelete } from '../../shared/api'
import { useAuth } from '../../shared/auth'
import HallForm from './HallForm'

export default function HallsList() {
  const { t } = useTranslation()
  const { me } = useAuth()
  const [halls, setHalls] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedHall, setSelectedHall] = useState<any>(null)
  const [isFormVisible, setIsFormVisible] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)

  useEffect(() => {
    if (me?.branchId) {
      loadHalls()
    }
  }, [me?.branchId])

  // Also reload when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (me?.branchId) {
        loadHalls()
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const loadHalls = async () => {
    if (!me?.branchId) return
    
    setLoading(true)
    try {
      const data: any = await apiGet(`/content/halls?branchId=${me.branchId}`)
      setHalls(Array.isArray(data) ? data : (data?.halls || []))
    } catch (error) {
      message.error(t('halls.load_failed') || 'Failed to load halls')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (hallId: string, status: string) => {
    try {
      await apiPatch(`/content/halls/${hallId}/status`, { status })
      message.success(t('halls.status_updated') || 'Status updated successfully')
      // Force reload halls data
      setTimeout(() => {
        loadHalls()
      }, 100)
    } catch (error) {
      message.error(t('halls.status_update_failed') || 'Failed to update status')
    }
  }

  const handleDelete = async (hallId: string, hallName: string) => {
    Modal.confirm({
      title: t('halls.delete_confirm_title') || 'Delete Hall',
      content: t('halls.delete_confirm_message', { name: hallName }) || `Are you sure you want to delete "${hallName}"? This action cannot be undone.`,
      okText: t('common.delete') || 'Delete',
      okType: 'danger',
      cancelText: t('common.cancel') || 'Cancel',
      onOk: async () => {
        try {
          await apiDelete(`/content/halls/${hallId}`)
          message.success(t('halls.deleted') || 'Hall deleted successfully')
          // Force reload halls data
          setTimeout(() => {
            loadHalls()
          }, 100)
        } catch (error) {
          message.error(t('halls.delete_failed') || 'Failed to delete hall')
        }
      },
    })
  }

  const handleEdit = (hall: any) => {
    setSelectedHall(hall)
    setIsEditMode(true)
    setIsFormVisible(true)
  }

  const handleCreate = () => {
    setSelectedHall(null)
    setIsEditMode(false)
    setIsFormVisible(true)
  }

  const handleFormClose = () => {
    setIsFormVisible(false)
    setSelectedHall(null)
    setIsEditMode(false)
  }

  const handleFormSuccess = () => {
    handleFormClose()
    // Force reload halls data
    setTimeout(() => {
      loadHalls()
    }, 100)
  }

  const columns = [
    {
      title: t('halls.name') || 'Name',
      dataIndex: 'name_ar',
      key: 'name_ar',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.name_en}</div>
        </div>
      ),
    },
    {
      title: t('halls.capacity') || 'Capacity',
      dataIndex: 'capacity',
      key: 'capacity',
      render: (capacity: number) => `${capacity} ${t('halls.persons') || 'persons'}`,
    },
    {
      title: t('halls.status') || 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const color = status === 'available' ? 'green' : status === 'maintenance' ? 'orange' : 'red'
        return <Tag color={color}>{t(`halls.${status}`) || status}</Tag>
      },
    },
    {
      title: t('halls.pricing') || 'Pricing',
      key: 'pricing',
      render: (record: any) => {
        const basePrice = record.priceConfig?.basePrice || 0
        return `${basePrice} SAR`
      },
    },
    {
      title: t('common.actions') || 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space>
          <Button 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => {
              // TODO: Implement view details
              message.info(t('halls.view_details_not_implemented') || 'View details not implemented yet')
            }}
          >
            {t('common.view_details') || 'View'}
          </Button>
          <Button 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('common.edit') || 'Edit'}
          </Button>
          <Button 
            size="small" 
            icon={<SettingOutlined />}
            onClick={() => {
              const newStatus = record.status === 'available' ? 'maintenance' : 'available'
              handleStatusChange(record.id, newStatus)
            }}
          >
            {record.status === 'available' ? t('halls.set_maintenance') || 'Set Maintenance' : t('halls.set_available') || 'Set Available'}
          </Button>
          <Button 
            size="small" 
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id, record.name_ar || record.name_en)}
          >
            {t('common.delete') || 'Delete'}
          </Button>
        </Space>
      ),
    },
  ]

  const stats = [
    {
      title: t('halls.total_halls') || 'Total Halls',
      value: halls.length,
      color: '#3b82f6',
    },
    {
      title: t('halls.available_halls') || 'Available',
      value: halls.filter(h => h.status === 'available').length,
      color: '#10b981',
    },
    {
      title: t('halls.maintenance_halls') || 'Maintenance',
      value: halls.filter(h => h.status === 'maintenance').length,
      color: '#f59e0b',
    },
    {
      title: t('halls.reserved_halls') || 'Reserved',
      value: halls.filter(h => h.status === 'reserved').length,
      color: '#ef4444',
    },
  ]

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">{t('halls.title') || 'Halls Management'}</h1>
            <p className="page-subtitle">{t('halls.subtitle') || 'Manage your branch halls and their availability'}</p>
          </div>
          <Space>
            <Button 
              icon={<ReloadOutlined />}
              onClick={loadHalls}
              loading={loading}
            >
              {t('common.refresh') || 'Refresh'}
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={handleCreate}
              className="btn-primary"
            >
              {t('halls.new') || 'New Hall'}
            </Button>
          </Space>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          {/* Stats Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            {stats.map((stat, index) => (
              <Col xs={12} sm={6} key={index}>
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

          {/* Halls Table */}
          <Card className="custom-card">
            <Table
              columns={columns}
              dataSource={halls}
              loading={loading}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} ${t('common.of') || 'of'} ${total} ${t('halls.halls') || 'halls'}`,
              }}
              className="custom-table"
            />
          </Card>
        </div>
      </div>

      {/* Hall Form Modal */}
      <Modal
        title={isEditMode ? t('halls.edit_title') || 'Edit Hall' : t('halls.create_title') || 'Create Hall'}
        open={isFormVisible}
        onCancel={handleFormClose}
        footer={null}
        width={800}
        destroyOnClose
      >
        <HallForm
          hall={selectedHall}
          onSuccess={handleFormSuccess}
          onCancel={handleFormClose}
        />
      </Modal>
    </div>
  )
}


