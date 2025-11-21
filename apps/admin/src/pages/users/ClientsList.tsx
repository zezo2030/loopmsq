import { useEffect, useState } from 'react'
import { Button, Space, Table, Tag, Input, Avatar, Tooltip } from 'antd'
import { useNavigate } from 'react-router-dom'
import { 
  UserOutlined, 
  SearchOutlined, 
  EyeOutlined, 
  EditOutlined,
  CustomerServiceOutlined
} from '@ant-design/icons'
import '../../theme.css'
import { useTranslation } from 'react-i18next'

type UserRow = {
  id: string
  name?: string
  email?: string
  phone?: string
  roles?: string[]
  isActive?: boolean
  createdAt?: string
}

function getApiBase(): string {
  const base = (import.meta as any).env?.VITE_API_BASE || (window as any).NEXT_PUBLIC_API_BASE
  return (typeof base === 'string' && base) ? base : 'http://localhost:3000/api/v1'
}

export default function ClientsList() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('accessToken')
        const resp = await fetch(`${getApiBase()}/users?page=1&limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!resp.ok) throw new Error(t('users.load_failed') || 'Failed to load users')
        const data = await resp.json()
        if (!mounted) return
        setRows(data.users || [])
      } catch {
        if (!mounted) return
        setRows([])
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  // Filter clients (users with role 'user')
  const clients = rows.filter(user => 
    user.roles?.includes('user') || user.roles?.includes('USER')
  )

  const filteredClients = clients.filter(client => {
    return !searchText || 
      client.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchText.toLowerCase()) ||
      client.phone?.includes(searchText)
  })

  const clientColumns = [
    {
      title: t('users.clients.client') || 'العميل',
      key: 'client',
      render: (_: any, record: UserRow) => (
        <Space size="middle">
          <Avatar 
            size={40} 
            icon={<UserOutlined />}
            style={{ backgroundColor: '#52c41a' }}
          />
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>
              {record.name || (t('users.unnamed') || 'Unnamed User')}
            </div>
            <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
              {record.email}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: t('users.phone') || 'الهاتف',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone?: string) => phone || <span style={{ color: '#8c8c8c' }}>—</span>
    },
    {
      title: t('users.status') || 'الحالة',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive?: boolean) => (
        <Tag 
          color={isActive ? 'success' : 'default'} 
          className="custom-tag"
        >
          {isActive ? (t('users.active') || '✓ Active') : (t('users.inactive') || '✗ Inactive')}
        </Tag>
      ),
    },
    {
      title: t('users.joined') || 'انضم',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date?: string) => 
        date ? new Date(date).toLocaleDateString('ar-SA', { calendar: 'gregory' }) : '—'
    },
    {
      title: t('common.actions') || 'إجراءات',
      key: 'actions',
      width: 120,
      render: (_: any, record: UserRow) => (
        <Space size="small">
          <Tooltip title={t('common.view_details') || 'View Details'}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/admin/users/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title={t('users.edit_user') || 'Edit User'}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/admin/users/${record.id}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">
              <CustomerServiceOutlined style={{ marginRight: '12px', color: '#52c41a' }} />
              {t('users.clients.title') || 'العملاء'}
            </h1>
            <p className="page-subtitle">
              {t('users.clients.subtitle') || 'عرض وإدارة جميع العملاء المسجلين في النظام'}
            </p>
          </div>
          <Tag color="green" style={{ fontSize: '16px', padding: '8px 16px', fontWeight: '600' }}>
            {filteredClients.length} {t('users.clients.total') || 'عميل'}
          </Tag>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          {/* Search */}
          <div style={{ 
            marginBottom: '24px', 
            padding: '24px', 
            background: 'var(--background-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <Input
              placeholder={t('users.clients.search_placeholder') || 'ابحث عن عميل بالاسم أو البريد أو الهاتف...'}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%', maxWidth: '500px' }}
              size="large"
              allowClear
            />
          </div>

          {/* Clients Table */}
          <div className="custom-table">
            <Table<UserRow>
              rowKey="id"
              dataSource={filteredClients}
              columns={clientColumns}
              loading={loading}
              pagination={{
                total: filteredClients.length,
                current: page,
                pageSize,
                showSizeChanger: true,
                showQuickJumper: true,
                onChange: (p, ps) => { setPage(p); setPageSize(ps) },
                showTotal: (total, range) => `${range[0]}-${range[1]} ${t('common.of') || 'من'} ${total} ${t('users.clients.client') || 'عميل'}`,
              }}
              scroll={{ x: 800 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

