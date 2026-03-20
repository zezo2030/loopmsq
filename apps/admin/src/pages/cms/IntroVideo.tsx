import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Switch, Table, message, Upload, Image, Space, Divider, Progress } from 'antd'
import { UploadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost, getApiBase } from '../../api'
import { resolveFileUrlWithBust } from '../../shared/url'
import { useTranslation } from 'react-i18next'

type IntroVideo = {
  id: string
  videoUrl: string
  videoCoverUrl?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function IntroVideo() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<IntroVideo[]>({
    queryKey: ['intro-videos'],
    queryFn: () => apiGet('/admin/intro-videos'),
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<IntroVideo | null>(null)
  const [form] = Form.useForm()
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)

  const createMutation = useMutation({
    mutationFn: (body: Partial<IntroVideo>) => apiPost<IntroVideo>('/admin/intro-videos', body),
    onSuccess: () => {
      message.success(t('intro_video.created'))
      qc.invalidateQueries({ queryKey: ['intro-videos'] })
      setOpen(false)
      form.resetFields()
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<IntroVideo> }) =>
      apiPatch(`/admin/intro-videos/${id}`, body),
    onSuccess: () => {
      message.success(t('intro_video.updated'))
      qc.invalidateQueries({ queryKey: ['intro-videos'] })
      setOpen(false)
      setEditing(null)
      form.resetFields()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/intro-videos/${id}`),
    onSuccess: () => {
      message.success(t('intro_video.removed'))
      qc.invalidateQueries({ queryKey: ['intro-videos'] })
    },
  })

  const isCloudinaryVideo = (url: string | null | undefined): boolean => {
    if (!url) return false
    return url.includes('cloudinary.com') || url.includes('res.cloudinary.com')
  }

  const columns = [
    {
      title: t('intro_video.video'),
      dataIndex: 'videoUrl',
      render: (_: any, r: IntroVideo) => {
        const isCloudinary = isCloudinaryVideo(r.videoUrl)
        if (r.videoCoverUrl) {
          return (
            <Image
              src={resolveFileUrlWithBust(r.videoCoverUrl)}
              width={80}
              height={50}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              preview={false}
            />
          )
        }
        return (
          <Space>
            <PlayCircleOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            <span>{isCloudinary ? t('intro_video.cloudinary_video') : t('intro_video.youtube_video')}</span>
          </Space>
        )
      },
    },
    {
      title: t('common.url') || 'URL',
      render: (_: any, r: IntroVideo) => (
        <a href={r.videoUrl} target="_blank" rel="noopener noreferrer">
          {r.videoUrl}
        </a>
      ),
    },
    { title: t('intro_video.active'), dataIndex: 'isActive', render: (v: boolean) => (v ? t('intro_video.yes') : t('intro_video.no')) },
    {
      title: t('common.actions'),
      render: (_: any, r: IntroVideo) => (
        <span style={{ display: 'flex', gap: 8 }}>
          <Button
            size="small"
            onClick={() => {
              setEditing(r)
              form.setFieldsValue({
                ...r,
                videoCoverUrl: r.videoCoverUrl || null,
              })
              setOpen(true)
            }}
          >
            {t('intro_video.edit')}
          </Button>
          <Button size="small" danger onClick={() => deleteMutation.mutate(r.id)}>
            {t('common.delete') || 'Delete'}
          </Button>
        </span>
      ),
    },
  ]

  const handleSubmit = () => {
    form.validateFields().then(values => {
      const body: Partial<IntroVideo> = {
        videoUrl: values.videoUrl,
        videoCoverUrl: values.videoCoverUrl || null,
        isActive: values.isActive ?? true,
      }

      if (editing) {
        updateMutation.mutate({ id: editing.id, body })
      } else {
        createMutation.mutate(body)
      }
    })
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null)
            form.resetFields()
            setOpen(true)
          }}
        >
          {t('intro_video.new')}
        </Button>
      </div>
      <Table rowKey="id" loading={isLoading} dataSource={data || []} columns={columns as any} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? t('intro_video.edit') : t('intro_video.new')}
        open={open}
        onCancel={() => {
          setOpen(false)
          setEditing(null)
          form.resetFields()
          setUploadProgress(0)
          setIsUploading(false)
        }}
        onOk={handleSubmit}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item label={t('intro_video.video')} required>
            <Space direction="vertical" style={{ width: '100%' }}>
              {form.getFieldValue('videoUrl') ? (
                <div>
                  {isCloudinaryVideo(form.getFieldValue('videoUrl')) ? (
                    <video
                      src={form.getFieldValue('videoUrl')}
                      controls
                      style={{ maxWidth: 300, maxHeight: 200, borderRadius: 8 }}
                    />
                  ) : (
                    <div style={{ padding: 8, background: '#f5f5f5', borderRadius: 8 }}>
                      <Space>
                        <PlayCircleOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                        <span>{form.getFieldValue('videoUrl')}</span>
                      </Space>
                    </div>
                  )}
                </div>
              ) : null}

              {isUploading && (
                <div>
                  <Progress
                    percent={uploadProgress}
                    status="active"
                    format={(percent) => {
                      const p = percent || 0
                      if (p < 85) return t('intro_video.upload_progress', { percent: p })
                      if (p < 100) return t('intro_video.processing')
                      return t('intro_video.completed')
                    }}
                  />
                </div>
              )}

              <Upload
                accept="video/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  setIsUploading(true)
                  setUploadProgress(0)

                  const fd = new FormData()
                  fd.append('file', file)

                  const xhr = new XMLHttpRequest()
                  xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                      const percentComplete = Math.round((e.loaded / e.total) * 85)
                      setUploadProgress(percentComplete)
                    }
                  })

                  xhr.addEventListener('load', () => {
                    if (xhr.status === 200 || xhr.status === 201) {
                      try {
                        const res = JSON.parse(xhr.responseText)
                        setUploadProgress(100)
                        form.setFieldsValue({
                          videoUrl: res.videoUrl,
                          videoCoverUrl: res.coverUrl || null,
                        })
                        setTimeout(() => {
                          setIsUploading(false)
                          setUploadProgress(0)
                        }, 800)
                        message.success(res.coverUrl ? t('intro_video.video_uploaded_with_cover') : t('intro_video.video_uploaded'))
                      } catch {
                        setIsUploading(false)
                        setUploadProgress(0)
                        message.error(t('intro_video.upload_failed'))
                      }
                    } else {
                      setIsUploading(false)
                      setUploadProgress(0)
                      try {
                        const errorRes = JSON.parse(xhr.responseText)
                        message.error(errorRes.message || t('intro_video.upload_failed'))
                      } catch {
                        message.error(t('intro_video.upload_failed'))
                      }
                    }
                  })

                  xhr.addEventListener('loadstart', () => setUploadProgress(5))
                  xhr.addEventListener('error', () => {
                    setIsUploading(false)
                    setUploadProgress(0)
                    message.error(t('intro_video.upload_failed'))
                  })
                  xhr.addEventListener('abort', () => {
                    setIsUploading(false)
                    setUploadProgress(0)
                  })

                  const apiBaseUrl = getApiBase()
                  xhr.open('POST', `${apiBaseUrl}/admin/intro-videos/upload-video`)

                  const token =
                    localStorage.getItem('accessToken') ||
                    localStorage.getItem('admin_token') ||
                    localStorage.getItem('token')
                  if (token) {
                    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
                  }

                  xhr.send(fd)
                  return false
                }}
              >
                <Button icon={<UploadOutlined />} disabled={isUploading}>
                  {isUploading ? t('intro_video.uploading') : t('intro_video.upload_video')}
                </Button>
              </Upload>

              <Divider>{t('intro_video.or')}</Divider>

              <Form.Item
                name="videoUrl"
                rules={[
                  { required: true, message: t('intro_video.video_url_required') },
                  { pattern: /^https?:\/\/.+/, message: t('intro_video.enter_valid_url') },
                ]}
              >
                <Input placeholder={t('intro_video.enter_video_url')} onChange={(e) => form.setFieldsValue({ videoUrl: e.target.value })} />
              </Form.Item>

              <Divider>{t('intro_video.video_cover')}</Divider>

              <Form.Item label={t('intro_video.video_cover')}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {form.getFieldValue('videoCoverUrl') ? (
                    <div>
                      <Image
                        src={resolveFileUrlWithBust(form.getFieldValue('videoCoverUrl'))}
                        width={200}
                        height={120}
                        style={{ objectFit: 'cover', borderRadius: 8 }}
                      />
                    </div>
                  ) : null}

                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      const fd = new FormData()
                      fd.append('file', file)
                      apiPost<{ coverUrl: string }>('/admin/intro-videos/upload-video-cover', fd)
                        .then((res) => {
                          form.setFieldsValue({ videoCoverUrl: res.coverUrl })
                          message.success(t('intro_video.cover_uploaded'))
                        })
                        .catch((err) => {
                          message.error(err.response?.data?.message || t('intro_video.upload_failed'))
                        })
                      return false
                    }}
                  >
                    <Button icon={<UploadOutlined />}>{t('intro_video.upload_cover')}</Button>
                  </Upload>

                  {form.getFieldValue('videoCoverUrl') && (
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        form.setFieldsValue({ videoCoverUrl: null })
                        message.info(t('intro_video.cover_removed'))
                      }}
                    >
                      {t('intro_video.remove_cover')}
                    </Button>
                  )}

                  <Form.Item name="videoCoverUrl" hidden>
                    <Input />
                  </Form.Item>
                </Space>
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item name="isActive" label={t('intro_video.active')} valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
