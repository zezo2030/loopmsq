import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Space,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  Col,
  Avatar,
  Badge,
  Steps,
  Select,
  Alert
} from 'antd'
import {
  ArrowLeftOutlined,
  BookOutlined,
  TeamOutlined,
  CalendarOutlined,
  DollarOutlined,
  CheckOutlined,
  FileTextOutlined,
  WarningOutlined,
  PhoneOutlined,
  MailOutlined,
  EditOutlined,
  FileExcelOutlined
} from '@ant-design/icons'
import { apiGet, apiPost } from '../../api'
import '../../theme.css'

type TripRequest = {
  id: string
  requester: {
    id: string
    name?: string
    email?: string
    phone?: string
  }
  schoolName: string
  studentsCount: number
  accompanyingAdults?: number
  preferredDate: string
  preferredTime?: string
  durationHours: number
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'invoiced' | 'paid' | 'completed' | 'cancelled'
  contactPersonName: string
  contactPhone: string
  contactEmail?: string
  specialRequirements?: string
  quotedPrice?: number
  rejectionReason?: string
  adminNotes?: string
  studentsList?: Array<{
    name: string
    age: number
    guardianName: string
    guardianPhone: string
  }>
  excelFilePath?: string
  addOns?: Array<{
    id: string
    name: string
    price: number
    quantity: number
  }>
  approvedAt?: string
  approvedBy?: string
  invoiceId?: string
  createdAt: string
  updatedAt: string
}

const { Step } = Steps

export default function TripDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [trip, setTrip] = useState<TripRequest | null>(null)
  const [loading, setLoading] = useState(true)

  // Modal states
  const [reviewModalVisible, setReviewModalVisible] = useState(false)

  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false)

  // Forms
  const [reviewForm] = Form.useForm()

  const [invoiceForm] = Form.useForm()

  // Loading states
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id) {
      loadTripData()
    }
  }, [id])

  async function loadTripData() {
    setLoading(true)
    try {
      const tripData = await apiGet<TripRequest>(`/trips/requests/${id}`)
      // Ensure requester object exists
      if (!tripData.requester) {
        tripData.requester = {
          id: '',
          name: undefined,
          email: undefined,
          phone: undefined
        }
      }
      setTrip(tripData)
    } catch (error) {
      console.error('Failed to load trip:', error)
      // Mock data for development
      setTrip({
        id: '1',
        requester: {
          id: '1',
          name: 'نورا أحمد المعلمة',
          email: 'nora@school.edu.sa',
          phone: '+966501234567'
        },
        schoolName: 'مدرسة النور الأهلية للبنات',
        studentsCount: 45,
        accompanyingAdults: 3,
        preferredDate: '2024-02-15',
        preferredTime: '09:00',
        durationHours: 3,
        status: 'approved',
        contactPersonName: 'نورا أحمد المعلمة',
        contactPhone: '+966501234567',
        contactEmail: 'nora@school.edu.sa',
        specialRequirements: 'لدينا 3 طالبات من ذوي الاحتياجات الخاصة يحتجن إلى كراسي متحركة. كما نحتاج إلى مكان آمن لحفظ الأدوية.',
        quotedPrice: 1800,
        adminNotes: 'تم الموافقة على الطلب. سيتم توفير المرافق اللازمة لذوي الاحتياجات الخاصة.',
        studentsList: [
          { name: 'فاطمة محمد', age: 12, guardianName: 'محمد علي', guardianPhone: '+966501111111' },
          { name: 'عائشة أحمد', age: 11, guardianName: 'أحمد سالم', guardianPhone: '+966502222222' }
        ],
        addOns: [
          { id: '1', name: 'وجبة إفطار للطلاب', price: 15, quantity: 45 },
          { id: '2', name: 'دليل سياحي', price: 200, quantity: 1 }
        ],
        approvedAt: '2024-01-21T10:30:00Z',
        approvedBy: 'admin-1',
        createdAt: '2024-01-20T08:00:00Z',
        updatedAt: '2024-01-21T10:30:00Z'
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(values: { quotedPrice: number; adminNotes?: string; addOns?: any[] }) {
    if (!trip) return

    setActionLoading(true)
    try {
      await apiPost(`/trips/requests/${trip.id}/approve`, values)
      message.success('تم قبول الطلب بنجاح')
      setReviewModalVisible(false)
      reviewForm.resetFields()
      await loadTripData()
    } catch (error) {
      message.error('فشل في قبول الطلب')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject(values: { rejectionReason: string }) {
    if (!trip) return

    setActionLoading(true)
    try {
      await apiPost(`/trips/requests/${trip.id}/reject`, values)
      message.success('تم رفض الطلب')
      setReviewModalVisible(false)
      reviewForm.resetFields()
      await loadTripData()
    } catch (error) {
      message.error('فشل في رفض الطلب')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleInvoice(values: any) {
    if (!trip) return

    setActionLoading(true)
    try {
      await apiPost(`/trips/requests/${trip.id}/invoice`, values)
      message.success('تم إرسال الفاتورة بنجاح')
      setInvoiceModalVisible(false)
      invoiceForm.resetFields()
      await loadTripData()
    } catch (error) {
      message.error('فشل في إرسال الفاتورة')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMarkPaid() {
    if (!trip) return

    setActionLoading(true)
    try {
      await apiPost(`/trips/requests/${trip.id}/mark-paid`, {})
      message.success('تم تحديث حالة الدفع بنجاح')
      await loadTripData()
    } catch (error) {
      message.error('فشل في تحديث حالة الدفع')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleIssueTickets() {
    if (!trip) return

    setActionLoading(true)
    try {
      await apiPost(`/trips/requests/${trip.id}/issue-tickets`, {})
      message.success('تم إصدار التذاكر بنجاح')
      await loadTripData()
    } catch (error) {
      message.error('فشل في إصدار التذاكر')
    } finally {
      setActionLoading(false)
    }
  }



  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'في الانتظار'
      case 'under_review': return 'قيد المراجعة'
      case 'approved': return 'مقبول'
      case 'rejected': return 'مرفوض'
      case 'invoiced': return 'تم إرسال الفاتورة'
      case 'paid': return 'تم الدفع'
      case 'completed': return 'مكتمل'
      case 'cancelled': return 'ملغي'
      default: return status
    }
  }

  const getCurrentStep = (status: string) => {
    switch (status) {
      case 'pending':
      case 'under_review':
        return 0
      case 'approved':
        return 1
      case 'invoiced':
        return 2
      case 'paid':
        return 3
      case 'completed':
        return 4
      case 'rejected':
      case 'cancelled':
        return -1
      default:
        return 0
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <Card loading={true} style={{ minHeight: '400px' }} />
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="page-container">
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <WarningOutlined style={{ fontSize: '48px', color: '#faad14', marginBottom: '16px' }} />
            <h3>لم يتم العثور على الطلب</h3>
            <Button type="primary" onClick={() => navigate('/admin/trips')}>
              العودة إلى قائمة الرحلات
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-content">
          <div>
            <Space size="middle" style={{ marginBottom: '8px' }}>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/admin/trips')}
                size="large"
              />
              <h1 className="page-title" style={{ margin: 0 }}>
                طلب رحلة مدرسية #{trip.id.slice(-8)}
              </h1>
              <Badge
                status={
                  trip.status === 'approved' || trip.status === 'completed'
                    ? 'success'
                    : trip.status === 'pending' || trip.status === 'under_review' || trip.status === 'invoiced' || trip.status === 'paid'
                      ? 'processing'
                      : trip.status === 'rejected' || trip.status === 'cancelled'
                        ? 'error'
                        : 'default'
                }
                text={getStatusText(trip.status)}
              />
            </Space>
            <p className="page-subtitle">
              {trip.schoolName} - {trip.studentsCount} طالب
            </p>
          </div>
          <Space>
            {trip.status === 'under_review' && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => setReviewModalVisible(true)}
              >
                مراجعة الطلب
              </Button>
            )}
            {trip.status === 'approved' && (
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={() => setInvoiceModalVisible(true)}
              >
                إرسال فاتورة
              </Button>
            )}
            {trip.status === 'invoiced' && (
              <Button
                type="primary"
                icon={<DollarOutlined />}
                onClick={handleMarkPaid}
                loading={actionLoading}
              >
                تأكيد الدفع
              </Button>
            )}
            {trip.status === 'paid' && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleIssueTickets}
                loading={actionLoading}
              >
                إصدار تذاكر
              </Button>
            )}
          </Space>
        </div>
      </div>

      <div className="page-content">
        <div className="page-content-inner">
          {/* Workflow Steps */}
          {trip.status !== 'rejected' && trip.status !== 'cancelled' && (
            <Card className="custom-card" style={{ marginBottom: '24px' }}>
              <Steps
                current={getCurrentStep(trip.status)}
                status={'process'}
                direction="horizontal"
                size="small"
              >
                <Step title="طلب مرسل" description="في انتظار المراجعة" />
                <Step title="قبول الطلب" description="تحديد السعر والتفاصيل" />
                <Step title="إرسال فاتورة" description="إرسال الفاتورة للمدرسة" />
                <Step title="تأكيد الدفع" description="استلام المبلغ" />
                <Step title="إصدار تذاكر" description="إصدار التذاكر النهائية" />
              </Steps>
            </Card>
          )}

          {trip.status === 'rejected' && (
            <Alert
              message="تم رفض الطلب"
              description={trip.rejectionReason}
              type="error"
              showIcon
              style={{ marginBottom: '24px' }}
            />
          )}

          <Row gutter={[24, 24]}>
            {/* School Information */}
            <Col xs={24} lg={12}>
              <Card className="custom-card" title="معلومات المدرسة" extra={<BookOutlined />}>
                <Space size="large" style={{ width: '100%' }} direction="vertical">
                  <div>
                    <h3 style={{ margin: '0 0 12px 0', color: '#1890ff' }}>{trip.schoolName}</h3>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="المسؤول">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar size={32} icon={<BookOutlined />} style={{ backgroundColor: '#52c41a' }} />
                          <div>
                            <div style={{ fontWeight: '600' }}>{trip.contactPersonName}</div>
                            {trip.requester?.name && (
                              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                                مقدم الطلب: {trip.requester.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </Descriptions.Item>
                      <Descriptions.Item label="الهاتف">
                        <Space>
                          <PhoneOutlined />
                          {trip.contactPhone}
                        </Space>
                      </Descriptions.Item>
                      {trip.contactEmail && (
                        <Descriptions.Item label="البريد الإلكتروني">
                          <Space>
                            <MailOutlined />
                            {trip.contactEmail}
                          </Space>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </div>
                </Space>
              </Card>
            </Col>

            {/* Trip Details */}
            <Col xs={24} lg={12}>
              <Card className="custom-card" title="تفاصيل الرحلة" extra={<CalendarOutlined />}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="التاريخ المفضل">
                    <div style={{ fontWeight: '600' }}>
                      {new Date(trip.preferredDate).toLocaleDateString('ar-SA', { calendar: 'gregory' })}
                      {trip.preferredTime && ` - ${trip.preferredTime}`}
                    </div>
                  </Descriptions.Item>
                  <Descriptions.Item label="المدة">{trip.durationHours} ساعات</Descriptions.Item>
                  <Descriptions.Item label="عدد الطلاب">
                    <Space>
                      <TeamOutlined />
                      {trip.studentsCount} طالب
                    </Space>
                  </Descriptions.Item>
                  {trip.accompanyingAdults && (
                    <Descriptions.Item label="المرافقون">
                      {trip.accompanyingAdults} شخص
                    </Descriptions.Item>
                  )}
                  {trip.quotedPrice && (
                    <Descriptions.Item label="السعر المقترح">
                      <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#52c41a' }}>
                        {trip.quotedPrice.toLocaleString()} ر.س
                      </span>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            </Col>

            {/* Special Requirements */}
            {trip.specialRequirements && (
              <Col xs={24}>
                <Card className="custom-card" title="المتطلبات الخاصة">
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#f6ffed',
                    border: '1px solid #b7eb8f',
                    borderRadius: '6px'
                  }}>
                    {trip.specialRequirements}
                  </div>
                </Card>
              </Col>
            )}

            {/* Add-ons */}
            {trip.addOns && trip.addOns.length > 0 && (
              <Col xs={24} lg={12}>
                <Card className="custom-card" title="الخدمات الإضافية">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {trip.addOns.map((addon, index) => (
                      <div key={index} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '12px',
                        backgroundColor: '#fafafa',
                        borderRadius: '6px'
                      }}>
                        <div>
                          <div style={{ fontWeight: '600' }}>{addon.name}</div>
                          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                            الكمية: {addon.quantity}
                          </div>
                        </div>
                        <div style={{ fontWeight: '600', color: '#52c41a' }}>
                          {(addon.price * addon.quantity).toLocaleString()} ر.س
                        </div>
                      </div>
                    ))}
                  </Space>
                </Card>
              </Col>
            )}

            {/* Students List */}
            {trip.studentsList && trip.studentsList.length > 0 && (
              <Col xs={24} lg={12}>
                <Card
                  className="custom-card"
                  title={`قائمة الطلاب (${trip.studentsList.length})`}
                  extra={<TeamOutlined />}
                >
                  <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                    {trip.studentsList.map((student, index) => (
                      <div key={index} style={{
                        padding: '8px 0',
                        borderBottom: index < trip.studentsList!.length - 1 ? '1px solid #f0f0f0' : 'none'
                      }}>
                        <div style={{ fontWeight: '600' }}>{student.name}</div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                          العمر: {student.age} - ولي الأمر: {student.guardianName}
                        </div>
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                          {student.guardianPhone}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </Col>
            )}

            {/* Excel File */}
            {trip.excelFilePath && (
              <Col xs={24}>
                <Card className="custom-card" title="ملف قائمة الطلاب">
                  <Button icon={<FileExcelOutlined />} type="link">
                    تحميل ملف Excel
                  </Button>
                </Card>
              </Col>
            )}

            {/* Admin Notes */}
            {trip.adminNotes && (
              <Col xs={24}>
                <Card className="custom-card" title="ملاحظات الإدارة">
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#e6f7ff',
                    border: '1px solid #91d5ff',
                    borderRadius: '6px'
                  }}>
                    {trip.adminNotes}
                  </div>
                </Card>
              </Col>
            )}
          </Row>
        </div>
      </div>

      {/* Review Modal */}
      <Modal
        title="مراجعة طلب الرحلة المدرسية"
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
        destroyOnClose
        width={600}
      >
        <Form
          form={reviewForm}
          layout="vertical"
          onFinish={handleApprove}
        >
          <Form.Item
            label="السعر المقترح (ريال سعودي)"
            name="quotedPrice"
            rules={[{ required: true, message: 'يرجى إدخال السعر المقترح' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value: any) => value?.replace(/\$\s?|(,*)/g, '')}
              placeholder="0"
            />
          </Form.Item>

          <Form.Item
            label="ملاحظات الإدارة"
            name="adminNotes"
          >
            <Input.TextArea
              rows={4}
              placeholder="أضف ملاحظات أو توجيهات خاصة بالرحلة..."
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Button onClick={() => setReviewModalVisible(false)}>
                إلغاء
              </Button>
              <Space>
                <Button
                  danger
                  onClick={() => {
                    Modal.confirm({
                      title: 'رفض الطلب',
                      content: (
                        <Form
                          onFinish={handleReject}
                          style={{ marginTop: '16px' }}
                        >
                          <Form.Item
                            name="rejectionReason"
                            rules={[{ required: true, message: 'يرجى إدخال سبب الرفض' }]}
                          >
                            <Input.TextArea
                              rows={3}
                              placeholder="اكتب سبب رفض الطلب..."
                            />
                          </Form.Item>
                        </Form>
                      ),
                      onOk: () => reviewForm.submit(),
                      okText: 'رفض الطلب',
                      cancelText: 'إلغاء',
                      okButtonProps: { danger: true }
                    })
                  }}
                >
                  رفض الطلب
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={actionLoading}
                  icon={<CheckOutlined />}
                >
                  قبول الطلب
                </Button>
              </Space>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Invoice Modal */}
      <Modal
        title="إرسال فاتورة"
        open={invoiceModalVisible}
        onCancel={() => setInvoiceModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={invoiceForm}
          layout="vertical"
          onFinish={handleInvoice}
          initialValues={{
            paymentMethod: 'bank_transfer'
          }}
        >
          <Form.Item
            label="طريقة الدفع المفضلة"
            name="paymentMethod"
            rules={[{ required: true, message: 'يرجى اختيار طريقة الدفع' }]}
          >
            <Select
              options={[
                { label: 'تحويل بنكي', value: 'bank_transfer' },
                { label: 'نقدي', value: 'cash' },
                { label: 'بطاقة ائتمان', value: 'credit_card' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="ملاحظات على الفاتورة"
            name="invoiceNotes"
          >
            <Input.TextArea
              rows={3}
              placeholder="ملاحظات إضافية للفاتورة..."
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'left' }}>
            <Space>
              <Button onClick={() => setInvoiceModalVisible(false)}>
                إلغاء
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={actionLoading}
                icon={<FileTextOutlined />}
              >
                إرسال فاتورة
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}


