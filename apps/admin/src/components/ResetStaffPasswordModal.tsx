import { useState } from 'react'
import { Form, Input, Modal, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { apiPatch } from '../shared/api'
import { parseApiErrorMessage } from '../shared/phone'

type Props = {
  userId: string
  userName?: string
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function ResetStaffPasswordModal({
  userId,
  userName,
  open,
  onClose,
  onSuccess,
}: Props) {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    form.resetFields()
    onClose()
  }

  const handleSubmit = async (values: {
    newPassword: string
    confirmPassword: string
  }) => {
    setLoading(true)
    try {
      await apiPatch(`/users/${userId}/reset-password`, {
        newPassword: values.newPassword,
      })
      message.success(
        t('users.password_reset_success') || 'Password reset successfully',
      )
      form.resetFields()
      onSuccess?.()
      onClose()
    } catch (error) {
      message.error(parseApiErrorMessage(error, t))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={t('users.reset_password') || 'Reset Password'}
      open={open}
      onCancel={handleClose}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText={t('users.reset_password') || 'Reset Password'}
      cancelText={t('common.cancel') || 'Cancel'}
      destroyOnClose
    >
      {userName && (
        <p style={{ marginBottom: 16 }}>
          {t('users.reset_password_for') || 'Reset password for'}:{' '}
          <strong>{userName}</strong>
        </p>
      )}
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label={t('users.new_password') || 'New Password'}
          name="newPassword"
          rules={[
            {
              required: true,
              message: t('users.enter_password') || 'Please enter password',
            },
            {
              min: 6,
              message:
                t('users.password_min_length') ||
                'Password must be at least 6 characters',
            },
          ]}
        >
          <Input.Password
            placeholder={t('users.create_password') || 'Enter new password'}
          />
        </Form.Item>
        <Form.Item
          label={t('users.confirm_password') || 'Confirm Password'}
          name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            {
              required: true,
              message:
                t('users.confirm_password_required') ||
                'Please confirm password',
            },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve()
                }
                return Promise.reject(
                  new Error(
                    t('users.passwords_do_not_match') ||
                      'Passwords do not match',
                  ),
                )
              },
            }),
          ]}
        >
          <Input.Password
            placeholder={
              t('users.confirm_password_ph') || 'Re-enter new password'
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
