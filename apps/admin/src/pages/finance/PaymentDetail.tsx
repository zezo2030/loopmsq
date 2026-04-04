import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api'
import { Card, Descriptions, Tag } from 'antd'
import { formatDayjsDisplayAr } from '../../utils/formatDateTimeDisplay'
import { useTranslation } from 'react-i18next'

export default function PaymentDetail() {
  const { id } = useParams()
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['payment', id],
    queryFn: async () => apiGet<any>(`/payments/admin/${id}`),
    enabled: !!id,
  })

  if (isLoading) return <Card loading />
  if (!data) return <Card>{t('common.not_found')}</Card>

  return (
    <Card title={`${t('payments.title')} ${data.id}`}>
      <Descriptions column={1} bordered>
        <Descriptions.Item label={t('payments.id')}>{data.id}</Descriptions.Item>
        <Descriptions.Item label={t('payments.booking_id')}>{data.bookingId}</Descriptions.Item>
        <Descriptions.Item label={t('payments.amount')}>{data.amount} {data.currency}</Descriptions.Item>
        <Descriptions.Item label={t('payments.status')}><Tag>{data.status}</Tag></Descriptions.Item>
        <Descriptions.Item label={t('payments.method')}>{data.method}</Descriptions.Item>
        <Descriptions.Item label={t('payments.transaction_id')}>{data.transactionId || '-'}</Descriptions.Item>
        <Descriptions.Item label={t('payments.paid_at')}>{data.paidAt ? formatDayjsDisplayAr(data.paidAt) : '-'}</Descriptions.Item>
        <Descriptions.Item label={t('payments.created_at')}>{formatDayjsDisplayAr(data.createdAt)}</Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
