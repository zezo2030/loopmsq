import { useEffect, useState } from 'react'
import { Button, Space, Table, Tag, Input, Select, Avatar, Tooltip, message, Popconfirm } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  UserOutlined, 
  SearchOutlined, 
  EyeOutlined, 
  EditOutlined,
  PlusOutlined,
  FilterOutlined,
  TeamOutlined
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

export default function UsersList() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('accessToken')
        const resp = await fetch(`${getApiBase()}/users?page=1&limit=50`, {
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

  // Initialize filters from URL on mount
  useEffect(() => {
    const q = searchParams.get('q') || ''
    const role = searchParams.get('role') || ''
    const p = Number(searchParams.get('page') || '1')
    const ps = Number(searchParams.get('pageSize') || '20')
    setSearchText(q)
    setRoleFilter(role)
    if (!Number.isNaN(p)) setPage(p)
    if (!Number.isNaN(ps)) setPageSize(ps)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync filters to URL
  useEffect(() => {
    const next = new URLSearchParams()
    if (searchText) next.set('q', searchText)
    if (roleFilter) next.set('role', roleFilter)
    next.set('page', String(page))
    next.set('pageSize', String(pageSize))
    setSearchParams(next, { replace: true })
  }, [searchText, roleFilter, page, pageSize, setSearchParams])

  const filteredData = rows.filter(user => {
    const matchesSearch = !searchText || 
      user.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchText.toLowerCase()) ||
      user.phone?.includes(searchText)
    
    const matchesRole = !roleFilter || user.roles?.includes(roleFilter)
    
    return matchesSearch && matchesRole
  })

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'red'
      case 'branch_manager': return 'blue'
      case 'staff': return 'green'
      case 'user': return 'default'
      default: return 'default'
    }
  }

  const columns = [
    {
      title: t('users.user') || 'User',
      key: 'user',
      render: (_: any, record: UserRow) => (
        <Space size="middle">
          <Avatar 
            size={40} 
            icon={<UserOutlined />}
            style={{ backgroundColor: '#1890ff' }}
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
      title: t('users.phone') || 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone?: string) => phone || <span style={{ color: '#8c8c8c' }}>—</span>
    },
    {
      title: t('users.roles') || 'Roles',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles?: string[]) => (
        <Space size={[0, 4]} wrap>
          {(roles || []).map(role => (
            <Tag key={role} color={getRoleColor(role)} className="custom-tag">
              {role.replace('_', ' ').toUpperCase()}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('users.status') || 'Status',
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
      title: t('users.joined') || 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date?: string) => 
        date ? new Date(date).toLocaleDateString() : '—'
    },
    {
      title: t('common.actions') || 'Actions',
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
          {record.isActive ? (
            <Popconfirm
              title={t('users.deactivate_q') || 'Deactivate user?'}
              okText={t('users.deactivate') || 'Deactivate'}
              cancelText={t('common.cancel') || 'Cancel'}
              onConfirm={async () => {
                try {
                  const token = localStorage.getItem('accessToken')
                  const resp = await fetch(`${getApiBase()}/users/${record.id}/deactivate`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  if (!resp.ok) throw new Error(await resp.text() || (t('users.failed') || 'Failed'))
                  message.success(t('users.deactivated') || 'User deactivated')
                  setRows(rows => rows.map(r => r.id === record.id ? { ...r, isActive: false } : r))
                } catch (e: any) {
                  message.error(e?.message || (t('users.deactivate_failed') || 'Failed to deactivate'))
                }
              }}
            >
              <Button type="link" size="small">{t('users.deactivate') || 'Deactivate'}</Button>
            </Popconfirm>
          ) : (
            <Button
              type="link"
              size="small"
              onClick={async () => {
                try {
                  const token = localStorage.getItem('accessToken')
                  const resp = await fetch(`${getApiBase()}/users/${record.id}/activate`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  if (!resp.ok) throw new Error(await resp.text() || (t('users.failed') || 'Failed'))
                  message.success(t('users.activated') || 'User activated')
                  setRows(rows => rows.map(r => r.id === record.id ? { ...r, isActive: true } : r))
                } catch (e: any) {
                  message.error(e?.message || (t('users.activate_failed') || 'Failed to activate'))
                }
              }}
            >
              {t('users.activate') || 'Activate'}
            </Button>
          )}
          <Popconfirm
            title={t('users.delete_q') || 'Delete permanently? This cannot be undone.'}
            okText={t('common.delete') || 'Delete'}
            okButtonProps={{ danger: true }}
            cancelText={t('common.cancel') || 'Cancel'}
            disabled={record.isActive}
            onConfirm={async () => {
              try {
                const token = localStorage.getItem('accessToken')
                const resp = await fetch(`${getApiBase()}/users/${record.id}/delete`, {
                  method: 'PATCH',
                  headers: { Authorization: `Bearer ${token}` },
                })
                if (!resp.ok) throw new Error(await resp.text() || (t('users.failed') || 'Failed'))
                message.success(t('users.deleted') || 'User deleted permanently')
                setRows(rows => rows.filter(r => r.id !== record.id))
              } catch (e: any) {
                message.error(e?.message || (t('users.delete_failed') || 'Failed to delete user'))
              }
            }}
          >
            <Button type="link" size="small" danger disabled={record.isActive}>
              {t('common.delete') || 'Delete'}
            </Button>
          </Popconfirm>
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
              <TeamOutlined style={{ marginRight: '12px' }} />
              {t('users.title') || 'User Management'}
            </h1>
            <p className="page-subtitle">
              {t('users.subtitle') || 'Manage users, staff, and branch managers across your platform'}
            </p>
          </div>
          <Space>
            <Button
              type="primary"
              className="btn-primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/admin/staff/new')}
            >
              {t('users.add_staff') || 'Add Staff'}
            </Button>
            <Button
              type="default"
              icon={<PlusOutlined />}
              onClick={() => navigate('/admin/branch-managers/new')}
            >
              {t('users.add_manager') || 'Add Manager'}
            </Button>
          </Space>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          {/* Search and Filters */}
          <div style={{ 
            marginBottom: '24px', 
            padding: '24px', 
            background: 'var(--background-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <Space size="middle" wrap>
              <Input
                placeholder={t('users.search_placeholder') || 'Search by name, email, or phone...'}
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 320 }}
                size="large"
                allowClear
              />
              
              <Select
                placeholder={t('users.filter_by_role') || 'Filter by role'}
                value={roleFilter}
                onChange={setRoleFilter}
                style={{ width: 180 }}
                size="large"
                allowClear
                suffixIcon={<FilterOutlined />}
                options={[
                  { label: t('roles.admin') || 'Admin', value: 'admin' },
                  { label: t('roles.branch_manager') || 'Branch Manager', value: 'branch_manager' },
                  { label: t('roles.staff') || 'Staff', value: 'staff' },
                  { label: t('roles.user') || 'User', value: 'user' },
                ]}
              />
            </Space>
          </div>

          {/* Users Table */}
          <div className="custom-table">
            <Table<UserRow>
              rowKey="id"
              dataSource={filteredData}
              columns={columns}
              loading={loading}
              pagination={{
                total: filteredData.length,
                current: page,
                pageSize,
                showSizeChanger: true,
                showQuickJumper: true,
                onChange: (p, ps) => { setPage(p); setPageSize(ps) },
                showTotal: (total, range) => `${range[0]}-${range[1]} ${t('common.of') || 'of'} ${total} ${t('users.users') || 'users'}`,
              }}
              scroll={{ x: 800 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}


