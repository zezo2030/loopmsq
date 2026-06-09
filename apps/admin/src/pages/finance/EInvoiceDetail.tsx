import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  QRCode,
  Typography,
  Alert,
  message,
} from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api'
import { formatDayjsDisplayAr } from '../../utils/formatDateTimeDisplay'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface EInvoiceDetail {
  id: string
  invoiceNumber: string
  uuid: string
  environment: string
  type: string
  documentType: string
  status: string
  icv: number
  pih: string
  invoiceHash?: string | null
  qrCode?: string | null
  signedXml?: string | null
  clearedXmlBase64?: string | null
  totalExclVat: number
  totalVat: number
  totalInclVat: number
  currency: string
  paymentId?: string | null
  submissionAttempts: number
  lastError?: string | null
  zatcaResponse?: any
  createdAt: string
  updatedAt: string
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

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function EInvoiceDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<EInvoiceDetail>({
    queryKey: ['einvoice', id],
    queryFn: () => apiGet<EInvoiceDetail>(`/admin/invoicing/invoices/${id}`),
    enabled: !!id,
  })

  const retry = useMutation({
    mutationFn: (paymentId: string) =>
      apiPost(`/admin/invoicing/payments/${paymentId}/issue`, {}),
    onSuccess: () => {
      message.success(t('einvoices.retry_queued') || 'Queued for re-issue')
      qc.invalidateQueries({ queryKey: ['einvoice', id] })
    },
    onError: (e: any) => message.error(e?.message || 'Failed'),
  })

  if (isLoading || !data) {
    return (
      <Card loading title={t('einvoices.detail_title') || 'E-Invoice'} />
    )
  }

  const signedXml = data.signedXml
  const clearedXml = data.clearedXmlBase64
    ? atob(data.clearedXmlBase64)
    : null

  return (
    <div
      className="page-container"
      style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 160px)' }}
    >
      <Card
        title={
          <Space>
            {data.invoiceNumber}
            <Tag color={statusColors[data.status] || 'default'}>
              {data.status}
            </Tag>
          </Space>
        }
        extra={
          <Space>
            <Link to="/admin/finance/einvoices">
              <Button>{t('common.back') || 'Back'}</Button>
            </Link>
            {(data.status === 'failed' || data.status === 'rejected') &&
              data.paymentId && (
                <Button
                  type="primary"
                  loading={retry.isPending}
                  onClick={() => retry.mutate(data.paymentId as string)}
                >
                  {t('einvoices.retry') || 'Retry'}
                </Button>
              )}
          </Space>
        }
      >
        {data.lastError && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('einvoices.last_error') || 'Last error'}
            description={data.lastError}
          />
        )}

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Descriptions
            bordered
            size="small"
            column={1}
            style={{ flex: 1, minWidth: 360 }}
          >
            <Descriptions.Item label={t('einvoices.uuid') || 'UUID'}>
              {data.uuid}
            </Descriptions.Item>
            <Descriptions.Item label={t('einvoices.environment') || 'Environment'}>
              {data.environment}
            </Descriptions.Item>
            <Descriptions.Item label={t('einvoices.type') || 'Type'}>
              {data.type} / {data.documentType}
            </Descriptions.Item>
            <Descriptions.Item label="ICV">{data.icv}</Descriptions.Item>
            <Descriptions.Item label={t('einvoices.total_excl') || 'Total (excl. VAT)'}>
              {Number(data.totalExclVat).toFixed(2)} {data.currency}
            </Descriptions.Item>
            <Descriptions.Item label={t('einvoices.vat') || 'VAT'}>
              {Number(data.totalVat).toFixed(2)} {data.currency}
            </Descriptions.Item>
            <Descriptions.Item label={t('einvoices.total') || 'Total (incl. VAT)'}>
              <b>
                {Number(data.totalInclVat).toFixed(2)} {data.currency}
              </b>
            </Descriptions.Item>
            <Descriptions.Item label={t('einvoices.payment') || 'Payment'}>
              {data.paymentId ? (
                <Link to={`/admin/finance/payments/${data.paymentId}`}>
                  {data.paymentId.slice(0, 8)}…
                </Link>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('einvoices.attempts') || 'Attempts'}>
              {data.submissionAttempts}
            </Descriptions.Item>
            <Descriptions.Item label={t('einvoices.created_at') || 'Created'}>
              {formatDayjsDisplayAr(data.createdAt)}
            </Descriptions.Item>
          </Descriptions>

          <div style={{ textAlign: 'center' }}>
            <Typography.Text type="secondary">
              {t('einvoices.qr') || 'ZATCA QR'}
            </Typography.Text>
            <div style={{ marginTop: 8 }}>
              {data.qrCode ? (
                <QRCode value={data.qrCode} size={200} />
              ) : (
                <Tag>{t('einvoices.no_qr') || 'No QR yet'}</Tag>
              )}
            </div>
          </div>
        </div>

        <Space style={{ marginTop: 16 }} wrap>
          {signedXml && (
            <Button
              onClick={() =>
                downloadText(`${data.invoiceNumber}-signed.xml`, signedXml)
              }
            >
              {t('einvoices.download_signed') || 'Download signed XML'}
            </Button>
          )}
          {clearedXml && (
            <Button
              onClick={() =>
                downloadText(`${data.invoiceNumber}-cleared.xml`, clearedXml)
              }
            >
              {t('einvoices.download_cleared') || 'Download cleared XML'}
            </Button>
          )}
        </Space>

        {data.invoiceHash && (
          <Typography.Paragraph
            copyable
            style={{ marginTop: 16, wordBreak: 'break-all' }}
          >
            <Typography.Text type="secondary">
              {t('einvoices.hash') || 'Invoice hash'}:{' '}
            </Typography.Text>
            {data.invoiceHash}
          </Typography.Paragraph>
        )}
      </Card>
    </div>
  )
}
