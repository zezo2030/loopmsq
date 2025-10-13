import { useEffect, useState } from 'react'
import { Button, Space, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('accessToken')
        const resp = await fetch(`${getApiBase()}/users?page=1&limit=20`, {
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

  return (
    <Table<UserRow>
      rowKey="id"
      dataSource={rows}
      loading={loading}
      columns={[
        { title: 'Name', dataIndex: 'name' },
        { title: 'Email', dataIndex: 'email' },
        { title: 'Phone', dataIndex: 'phone' },
        {
          title: 'Roles',
          dataIndex: 'roles',
          render: (roles?: string[]) => (roles || []).map(r => <Tag key={r}>{r}</Tag>),
        },
        {
          title: 'Active',
          dataIndex: 'isActive',
          render: (v?: boolean) => v ? 'Yes' : 'No',
        },
        {
          title: 'Actions',
          render: (_: any, row: UserRow) => (
            <Space>
              <Button size="small" onClick={() => navigate(`/users/${row.id}`)}>View</Button>
            </Space>
          ),
        },
      ]}
    />
  )
}


