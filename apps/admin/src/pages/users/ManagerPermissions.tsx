import { useEffect, useState } from 'react'
import {
  Table,
  Switch,
  Space,
  Avatar,
  Tag,
  Input,
  message,
  Tooltip,
} from 'antd'
import {
  UserOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  DollarOutlined,
  FileTextOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import '../../theme.css'
import { apiGet, apiPatch } from '../../shared/api'

type ManagerPerms = {
  canViewRevenue: boolean
  canViewBookingAmounts: boolean
  canManageWallets: boolean
}

type ManagerRow = {
  id: string
  name: string
  email?: string
  branchId?: string
  branchName?: string
  isActive: boolean
  permissions: ManagerPerms
}

export default function ManagerPermissions() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<ManagerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiGet<ManagerRow[]>(`/users/branch-managers/permissions`)
      setRows(Array.isArray(data) ? data : [])
    } catch (e: any) {
      message.error(e?.message || (t('manager_perms.load_failed') || 'Failed to load managers'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const togglePerm = async (
    row: ManagerRow,
    key: keyof ManagerPerms,
    value: boolean,
  ) => {
    setSavingId(row.id)
    const previous = row.permissions[key]
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, permissions: { ...r.permissions, [key]: value } }
          : r,
      ),
    )
    try {
      await apiPatch(`/users/${row.id}/permissions`, { [key]: value })
      message.success(t('manager_perms.saved') || 'Permission updated')
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, permissions: { ...r.permissions, [key]: previous } }
            : r,
        ),
      )
      message.error(e?.message || (t('manager_perms.save_failed') || 'Failed to update'))
    } finally {
      setSavingId(null)
    }
  }

  const filtered = rows.filter((r) => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      r.name?.toLowerCase().includes(s) ||
      r.email?.toLowerCase().includes(s) ||
      r.branchName?.toLowerCase().includes(s)
    )
  })

  const columns = [
    {
      title: t('manager_perms.manager') || 'Manager',
      key: 'manager',
      render: (_: any, r: ManagerRow) => (
        <Space size="middle">
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
          <div>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div style={{ color: '#8c8c8c', fontSize: 12 }}>{r.email || '—'}</div>
          </div>
        </Space>
      ),
    },
    {
      title: t('manager_perms.branch') || 'Branch',
      key: 'branch',
      render: (_: any, r: ManagerRow) =>
        r.branchName ? (
          <Tag color="blue" className="custom-tag">{r.branchName}</Tag>
        ) : (
          <span style={{ color: '#8c8c8c' }}>—</span>
        ),
    },
    {
      title: t('manager_perms.status') || 'Status',
      key: 'status',
      render: (_: any, r: ManagerRow) => (
        <Tag color={r.isActive ? 'success' : 'default'} className="custom-tag">
          {r.isActive
            ? t('users.active') || 'Active'
            : t('users.inactive') || 'Inactive'}
        </Tag>
      ),
    },
    {
      title: (
        <Space>
          <DollarOutlined />
          {t('manager_perms.can_view_revenue') || 'View Revenue'}
        </Space>
      ),
      key: 'canViewRevenue',
      width: 180,
      render: (_: any, r: ManagerRow) => (
        <Tooltip
          title={
            t('manager_perms.can_view_revenue_hint') ||
            'Allow this manager to see revenue figures and financial reports'
          }
        >
          <Switch
            checked={r.permissions.canViewRevenue}
            loading={savingId === r.id}
            onChange={(v) => togglePerm(r, 'canViewRevenue', v)}
          />
        </Tooltip>
      ),
    },
    {
      title: (
        <Space>
          <FileTextOutlined />
          {t('manager_perms.can_view_amounts') || 'View Booking Amounts'}
        </Space>
      ),
      key: 'canViewBookingAmounts',
      width: 220,
      render: (_: any, r: ManagerRow) => (
        <Tooltip
          title={
            t('manager_perms.can_view_amounts_hint') ||
            'Allow this manager to see prices on bookings, subscriptions, and offer bookings'
          }
        >
          <Switch
            checked={r.permissions.canViewBookingAmounts}
            loading={savingId === r.id}
            onChange={(v) => togglePerm(r, 'canViewBookingAmounts', v)}
          />
        </Tooltip>
      ),
    },
    {
      title: (
        <Space>
          <WalletOutlined />
          {t('manager_perms.can_manage_wallets') || 'Manage Wallets'}
        </Space>
      ),
      key: 'canManageWallets',
      width: 200,
      render: (_: any, r: ManagerRow) => (
        <Tooltip
          title={
            t('manager_perms.can_manage_wallets_hint') ||
            'Allow this manager to view user wallets and credit/debit their balance and points'
          }
        >
          <Switch
            checked={r.permissions.canManageWallets}
            loading={savingId === r.id}
            onChange={(v) => togglePerm(r, 'canManageWallets', v)}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div className="page-container" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <h1 className="page-title">
              <SafetyCertificateOutlined style={{ marginRight: 12 }} />
              {t('manager_perms.title') || 'Branch Manager Financial Permissions'}
            </h1>
            <p className="page-subtitle">
              {t('manager_perms.subtitle') ||
                'Control which financial data each branch manager can see in their dashboard'}
            </p>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          <div
            style={{
              marginBottom: 24,
              padding: 24,
              background: 'var(--background-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <Input
              size="large"
              placeholder={
                t('manager_perms.search_placeholder') ||
                'Search by name, email, or branch...'
              }
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ maxWidth: 420 }}
              allowClear
            />
          </div>

          <div className="custom-table">
            <Table<ManagerRow>
              rowKey="id"
              dataSource={filtered}
              columns={columns as any}
              loading={loading}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              scroll={{ x: 800 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
