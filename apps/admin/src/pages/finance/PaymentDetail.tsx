import { useParams, Link } from 'react-router-dom'
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

  const refs: Array<{ label: string; id: string; link?: string }> = []
  if (data.bookingId) refs.push({ label: t('payments.ref_booking') || 'Booking', id: data.bookingId, link: `/admin/bookings/${data.bookingId}` })
  if (data.eventRequestId) refs.push({ label: t('payments.ref_event') || 'Event', id: data.eventRequestId, link: `/admin/events/${data.eventRequestId}` })
  if (data.tripRequestId) refs.push({ label: t('payments.ref_trip') || 'Trip', id: data.tripRequestId, link: `/admin/trips/${data.tripRequestId}` })
  if (data.offerBookingId) refs.push({ label: t('payments.ref_offer') || 'Offer', id: data.offerBookingId, link: `/admin/finance/offer-bookings/${data.offerBookingId}` })
  if (data.subscriptionPurchaseId) refs.push({ label: t('payments.ref_subscription') || 'Subscription', id: data.subscriptionPurchaseId, link: `/admin/finance/subscriptions/${data.subscriptionPurchaseId}` })
  if (data.giftOrderId) refs.push({ label: t('payments.ref_gift') || 'Gift', id: data.giftOrderId })
  const flowType = data.webhookData?.flowType
  const isWalletRecharge = refs.length === 0 && flowType === 'wallet_recharge'

  return (
    <Card title={`${t('payments.title')} ${data.id}`}>
      <Descriptions column={1} bordered>
        <Descriptions.Item label={t('payments.id')}>{data.id}</Descriptions.Item>
        <Descriptions.Item label={t('payments.reference')}>
          {isWalletRecharge ? (
            <Tag color="purple">{t('payments.ref_wallet_recharge') || 'Wallet Recharge'}</Tag>
          ) : refs.length === 0 ? (
            flowType ? <Tag>{flowType}</Tag> : '-'
          ) : (
            refs.map((x, i) => (
              <span key={i} style={{ marginInlineEnd: 12 }}>
                <Tag>{x.label}</Tag>
                {x.link ? <Link to={x.link}>{x.id}</Link> : x.id}
              </span>
            ))
          )}
        </Descriptions.Item>
        <Descriptions.Item label={t('payments.amount')}>{data.amount} {data.currency}</Descriptions.Item>
        <Descriptions.Item label={t('payments.status')}><Tag>{data.status}</Tag></Descriptions.Item>
        <Descriptions.Item label={t('payments.method')}>{data.method}</Descriptions.Item>
        <Descriptions.Item label={t('payments.transaction_id')}>{data.transactionId || '-'}</Descriptions.Item>
        <Descriptions.Item label={t('payments.gateway_ref')}>{data.gatewayRef || '-'}</Descriptions.Item>
        <Descriptions.Item label={t('payments.paid_at')}>{data.paidAt ? formatDayjsDisplayAr(data.paidAt) : '-'}</Descriptions.Item>
        <Descriptions.Item label={t('payments.created_at')}>{formatDayjsDisplayAr(data.createdAt)}</Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
