import { useEffect, useState } from 'react'
import { Button, Space, Table, Tag, Input, Select, Avatar, Tooltip, message, Popconfirm } from 'antd'
import { useNavigate } from 'react-router-dom'
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
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
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
        if (!resp.ok) throw new Error('Failed to load users')
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
      title: 'User',
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
              {record.name || 'Unnamed User'}
            </div>
            <div style={{ color: '#8c8c8c', fontSize: '12px' }}>
              {record.email}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone?: string) => phone || <span style={{ color: '#8c8c8c' }}>—</span>
    },
    {
      title: 'Roles',
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
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive?: boolean) => (
        <Tag 
          color={isActive ? 'success' : 'default'} 
          className="custom-tag"
        >
          {isActive ? '✓ Active' : '✗ Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date?: string) => 
        date ? new Date(date).toLocaleDateString() : '—'
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: UserRow) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button 
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/users/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Edit User">
            <Button 
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/users/${record.id}`)}
            />
          </Tooltip>
          {record.isActive ? (
            <Popconfirm
              title="Deactivate user?"
              okText="Deactivate"
              cancelText="Cancel"
              onConfirm={async () => {
                try {
                  const token = localStorage.getItem('accessToken')
                  const resp = await fetch(`${getApiBase()}/users/${record.id}/deactivate`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  if (!resp.ok) throw new Error(await resp.text() || 'Failed')
                  message.success('User deactivated')
                  setRows(rows => rows.map(r => r.id === record.id ? { ...r, isActive: false } : r))
                } catch (e: any) {
                  message.error(e?.message || 'Failed to deactivate')
                }
              }}
            >
              <Button type="link" size="small">Deactivate</Button>
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
                  if (!resp.ok) throw new Error(await resp.text() || 'Failed')
                  message.success('User activated')
                  setRows(rows => rows.map(r => r.id === record.id ? { ...r, isActive: true } : r))
                } catch (e: any) {
                  message.error(e?.message || 'Failed to activate')
                }
              }}
            >
              Activate
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">
              <TeamOutlined style={{ marginRight: '12px' }} />
              User Management
            </h1>
            <p className="page-subtitle">
              Manage users, staff, and branch managers across your platform
            </p>
          </div>
          <Space>
            <Button 
              type="primary" 
              className="btn-primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/staff/new')}
            >
              Add Staff
            </Button>
            <Button 
              type="default"
              icon={<PlusOutlined />}
              onClick={() => navigate('/branch-managers/new')}
            >
              Add Manager
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
                placeholder="Search by name, email, or phone..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 320 }}
                size="large"
                allowClear
              />
              
              <Select
                placeholder="Filter by role"
                value={roleFilter}
                onChange={setRoleFilter}
                style={{ width: 180 }}
                size="large"
                allowClear
                suffixIcon={<FilterOutlined />}
                options={[
                  { label: 'Admin', value: 'admin' },
                  { label: 'Branch Manager', value: 'branch_manager' },
                  { label: 'Staff', value: 'staff' },
                  { label: 'User', value: 'user' },
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
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => 
                  `${range[0]}-${range[1]} of ${total} users`,
              }}
              scroll={{ x: 800 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}


