import { useMemo, useState } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Alert,
  Input,
  Modal,
  message,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api'
import { formatDayjsDisplayAr } from '../../utils/formatDateTimeDisplay'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface EInvoiceItem {
  id: string
  invoiceNumber: string
  uuid: string
  environment: string
  type: 'standard' | 'simplified'
  documentType: 'invoice' | 'credit_note' | 'debit_note'
  status: string
  icv: number
  totalExclVat: number
  totalVat: number
  totalInclVat: number
  currency: string
  paymentId?: string | null
  submissionAttempts: number
  lastError?: string | null
  createdAt: string
}

interface ListResponse {
  items: EInvoiceItem[]
  total: number
}

interface OnboardingStatus {
  environment: string
  onboarded: boolean
  stage?: string
  credentialId?: string
}

interface ToolchainHealth {
  ready: boolean
  enabled: boolean
  java?: string
  jarPath?: string
  sdkHome?: string
  errors: string[]
}

const statusColors: Record<string, string> = {
  cleared: 'green',
  reported: 'green',
  compliance_passed: 'cyan',
  signed: 'blue',
  draft: 'default',
  rejected: 'red',
  failed: 'red',
}

export default function EInvoicesList() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [otp, setOtp] = useState('')
  const [onboardOpen, setOnboardOpen] = useState(false)

  const { data: status, refetch: refetchStatus } = useQuery<OnboardingStatus>({
    queryKey: ['einvoice-onboarding-status'],
    queryFn: () => apiGet<OnboardingStatus>('/admin/invoicing/onboarding-status'),
  })

  const { data: health } = useQuery<ToolchainHealth>({
    queryKey: ['einvoice-health'],
    queryFn: () => apiGet<ToolchainHealth>('/admin/invoicing/health'),
  })

  const queryKey = useMemo(() => ['einvoices', { page, pageSize }], [page, pageSize])
  const { data, isLoading, refetch } = useQuery<ListResponse>({
    queryKey,
    queryFn: () => {
      const offset = (page - 1) * pageSize
      return apiGet<ListResponse>(
        `/admin/invoicing/invoices?limit=${pageSize}&offset=${offset}`,
      )
    },
  })

  const onboard = useMutation({
    mutationFn: () => apiPost('/admin/invoicing/onboard', otp ? { otp } : {}),
    onSuccess: () => {
      message.success(t('einvoices.onboard_success') || 'Onboarding completed')
      setOnboardOpen(false)
      setOtp('')
      refetchStatus()
    },
    onError: (e: any) =>
      message.error(e?.message || t('einvoices.onboard_failed') || 'Onboarding failed'),
  })

  const retry = useMutation({
    mutationFn: (paymentId: string) =>
      apiPost(`/admin/invoicing/payments/${paymentId}/issue`, {}),
    onSuccess: () => {
      message.success(t('einvoices.retry_queued') || 'Queued for re-issue')
      qc.invalidateQueries({ queryKey: ['einvoices'] })
    },
    onError: (e: any) => message.error(e?.message || 'Failed'),
  })

  const columns = [
    {
      title: t('einvoices.number') || 'Invoice #',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      render: (v: string, r: EInvoiceItem) => (
        <Link to={`/admin/finance/einvoices/${r.id}`}>{v}</Link>
      ),
    },
    {
      title: t('einvoices.type') || 'Type',
      key: 'type',
      render: (_: any, r: EInvoiceItem) => (
        <Space size={4}>
          <Tag color={r.type === 'standard' ? 'geekblue' : 'purple'}>
            {r.type === 'standard'
              ? t('einvoices.standard') || 'Standard'
              : t('einvoices.simplified') || 'Simplified'}
          </Tag>
          {r.documentType !== 'invoice' && (
            <Tag>{r.documentType === 'credit_note' ? 'CN' : 'DN'}</Tag>
          )}
        </Space>
      ),
    },
    { title: 'ICV', dataIndex: 'icv', key: 'icv', width: 80 },
    {
      title: t('einvoices.total') || 'Total (incl. VAT)',
      key: 'total',
      render: (_: any, r: EInvoiceItem) =>
        `${Number(r.totalInclVat).toFixed(2)} ${r.currency}`,
    },
    {
      title: t('einvoices.vat') || 'VAT',
      key: 'vat',
      render: (_: any, r: EInvoiceItem) => Number(r.totalVat).toFixed(2),
    },
    {
      title: t('einvoices.status') || 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={statusColors[s] || 'default'}>{s}</Tag>
      ),
    },
    {
      title: t('einvoices.created_at') || 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => formatDayjsDisplayAr(d),
    },
    {
      title: t('common.actions') || 'Actions',
      key: 'actions',
      render: (_: any, r: EInvoiceItem) =>
        (r.status === 'failed' || r.status === 'rejected') && r.paymentId ? (
          <Button
            size="small"
            loading={retry.isPending}
            onClick={() => retry.mutate(r.paymentId as string)}
          >
            {t('einvoices.retry') || 'Retry'}
          </Button>
        ) : (
          '-'
        ),
    },
  ]

  return (
    <div
      className="page-container"
      style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}
    >
      <Card
        title={t('einvoices.title') || 'ZATCA E-Invoices'}
        extra={
          <Button onClick={() => refetch()}>
            {t('common.refresh') || 'Refresh'}
          </Button>
        }
      >
        {health && !health.ready && (
          <Alert
            style={{ marginBottom: 16 }}
            type="error"
            showIcon
            message={t('einvoices.toolchain_not_ready') || 'ZATCA toolchain not ready'}
            description={
              <>
                {(health.errors || []).map((e, i) => (
                  <div key={i}>• {e}</div>
                ))}
                <div style={{ marginTop: 4, opacity: 0.7 }}>
                  java: {health.java || '—'} | jar: {health.jarPath || '—'} | sdk:{' '}
                  {health.sdkHome || '—'}
                </div>
              </>
            }
          />
        )}

        <Alert
          style={{ marginBottom: 16 }}
          type={status?.onboarded ? 'success' : 'warning'}
          showIcon
          message={
            status?.onboarded
              ? `${t('einvoices.onboarded') || 'Onboarded'} — ${status.environment} (${status.stage})`
              : `${t('einvoices.not_onboarded') || 'Not onboarded'} — ${status?.environment ?? ''}`
          }
          action={
            <Button
              size="small"
              type={status?.onboarded ? 'default' : 'primary'}
              onClick={() => setOnboardOpen(true)}
            >
              {status?.onboarded
                ? t('einvoices.re_onboard') || 'Re-onboard'
                : t('einvoices.onboard') || 'Onboard'}
            </Button>
          }
        />

        <Table
          rowKey="id"
          loading={isLoading}
          columns={columns as any}
          dataSource={data?.items || []}
          pagination={{
            current: page,
            pageSize,
            total: data?.total || 0,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        />
      </Card>

      <Modal
        title={t('einvoices.onboard_title') || 'ZATCA Onboarding'}
        open={onboardOpen}
        onCancel={() => setOnboardOpen(false)}
        onOk={() => onboard.mutate()}
        confirmLoading={onboard.isPending}
        okText={t('einvoices.run_onboard') || 'Run onboarding'}
      >
        <p>
          {t('einvoices.onboard_help') ||
            'Generate an OTP in the Fatoora portal and paste it below. This requests the compliance + production CSID for the current environment.'}
        </p>
        <Input
          placeholder={t('einvoices.otp') || 'OTP'}
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />
      </Modal>
    </div>
  )
}
