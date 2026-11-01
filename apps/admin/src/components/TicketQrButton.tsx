import { useState } from 'react'
import { Button, Modal, Space, Tag, Typography } from 'antd'
import { DownloadOutlined, QrcodeOutlined } from '@ant-design/icons'

const { Text } = Typography

type Props = {
  /** PNG data URL rendered by the API (offer ticket `qrImage`). */
  qrImage?: string | null
  ticketId: string
  status?: string
  label?: string
}

/** Opens a ticket's QR code so staff can show or scan it from the dashboard. */
export default function TicketQrButton({ qrImage, ticketId, status, label }: Props) {
  const [open, setOpen] = useState(false)
  if (!qrImage) return <Text type="secondary">-</Text>

  const shortId = ticketId.slice(0, 8)
  return (
    <>
      <Button size="small" icon={<QrcodeOutlined />} onClick={() => setOpen(true)}>
        QR
      </Button>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title={label ? `${label} — #${shortId}` : `#${shortId}`}
        centered
        width={360}
        footer={[
          <Button key="download" icon={<DownloadOutlined />} href={qrImage} download={`ticket-${shortId}.png`}>
            تنزيل
          </Button>,
          <Button key="close" type="primary" onClick={() => setOpen(false)}>
            إغلاق
          </Button>,
        ]}
      >
        <Space direction="vertical" align="center" style={{ width: '100%' }}>
          <img src={qrImage} alt={`QR ${shortId}`} style={{ width: 256, height: 256 }} />
          {status && <Tag>{status}</Tag>}
        </Space>
      </Modal>
    </>
  )
}
