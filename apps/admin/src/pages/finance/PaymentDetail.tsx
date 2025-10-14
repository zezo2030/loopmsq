import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api'
import { Card, Descriptions, Tag } from 'antd'
import dayjs from 'dayjs'

export default function PaymentDetail() {
  const { id } = useParams()
  const { data, isLoading } = useQuery({
    queryKey: ['payment', id],
    queryFn: async () => apiGet<any>(`/payments/admin/${id}`),
    enabled: !!id,
  })

  if (isLoading) return <Card loading />
  if (!data) return <Card>Not found</Card>

  return (
    <Card title={`Payment ${data.id}`}> 
      <Descriptions column={1} bordered>
        <Descriptions.Item label="Payment ID">{data.id}</Descriptions.Item>
        <Descriptions.Item label="Booking ID">{data.bookingId}</Descriptions.Item>
        <Descriptions.Item label="Amount">{data.amount} {data.currency}</Descriptions.Item>
        <Descriptions.Item label="Status"><Tag>{data.status}</Tag></Descriptions.Item>
        <Descriptions.Item label="Method">{data.method}</Descriptions.Item>
        <Descriptions.Item label="Transaction ID">{data.transactionId || '-'}</Descriptions.Item>
        <Descriptions.Item label="Paid At">{data.paidAt ? dayjs(data.paidAt).format('YYYY-MM-DD HH:mm') : '-'}</Descriptions.Item>
        <Descriptions.Item label="Created At">{dayjs(data.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
      </Descriptions>
    </Card>
  )
}
