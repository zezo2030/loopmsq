import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Switch, Table, message, Upload, Image, Space, Radio, Divider, Progress } from 'antd'
import { UploadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { resolveFileUrlWithBust } from '../../shared/url'
import { useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost, getApiBase } from '../../api'
import { useTranslation } from 'react-i18next'

type Activity = {
  id: string
  imageUrl?: string | null
  videoUrl?: string | null
  videoCoverUrl?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function Activities() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Activity[]>({ 
    queryKey: ['activities'], 
    queryFn: () => apiGet('/admin/activities') 
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [form] = Form.useForm()
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)

  const createMutation = useMutation({
    mutationFn: (body: Partial<Activity>) => apiPost<Activity>('/admin/activities', body),
    onSuccess: () => { 
      message.success(t('activities.created')); 
      qc.invalidateQueries({ queryKey: ['activities'] }); 
      setOpen(false);
      form.resetFields();
      setMediaType('image');
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Activity> }) => apiPatch(`/admin/activities/${id}`, body),
    onSuccess: () => { 
      message.success(t('activities.updated')); 
      qc.invalidateQueries({ queryKey: ['activities'] }); 
      setOpen(false); 
      setEditing(null);
      form.resetFields();
      setMediaType('image');
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/activities/${id}`),
    onSuccess: () => { 
      message.success(t('activities.removed')); 
      qc.invalidateQueries({ queryKey: ['activities'] }) 
    },
  })

  const isCloudinaryVideo = (url: string | null | undefined): boolean => {
    if (!url) return false
    return url.includes('cloudinary.com') || url.includes('res.cloudinary.com')
  }

  const columns = [
    { 
      title: t('activities.media'), 
      dataIndex: 'imageUrl', 
      render: (_: any, r: Activity) => {
        if (r.videoUrl) {
          const isCloudinary = isCloudinaryVideo(r.videoUrl)
          // Show cover if available, otherwise show video icon
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
              <span>{isCloudinary ? t('activities.cloudinary_video') : t('activities.youtube_video')}</span>
            </Space>
          )
        }
        if (r.imageUrl) {
          return <Image src={resolveFileUrlWithBust(r.imageUrl)} width={80} height={50} style={{ objectFit: 'cover' }} />
        }
        return '-'
      }
    },
    { 
      title: t('activities.url'), 
      render: (_: any, r: Activity) => {
        if (r.videoUrl) return <a href={r.videoUrl} target="_blank" rel="noopener noreferrer">{r.videoUrl}</a>
        if (r.imageUrl) return <span>{r.imageUrl}</span>
        return '-'
      }
    },
    { title: t('activities.active'), dataIndex: 'isActive', render: (v: boolean) => (v ? t('activities.yes') : t('activities.no')) },
    {
      title: t('common.actions'), 
      render: (_: any, r: Activity) => (
        <span style={{ display: 'flex', gap: 8 }}>
          <Button 
            size="small" 
            onClick={() => { 
              setEditing(r); 
              const type = r.videoUrl ? 'video' : 'image';
              setMediaType(type);
              form.setFieldsValue({ 
                ...r,
                mediaType: type,
                videoCoverUrl: r.videoCoverUrl || null,
              }); 
              setOpen(true) 
            }}
          >
            {t('activities.edit')}
          </Button>
          <Button 
            size="small" 
            danger 
            onClick={() => deleteMutation.mutate(r.id)}
          >
            {t('activities.delete')}
          </Button>
        </span>
      )
    },
  ]

  const handleSubmit = () => {
    form.validateFields().then(values => {
      const body: any = {
        isActive: values.isActive ?? true,
      }
      
      if (mediaType === 'image') {
        body.imageUrl = values.imageUrl || null
        body.videoUrl = null
        body.videoCoverUrl = null
      } else {
        body.videoUrl = values.videoUrl || null
        body.imageUrl = null
        body.videoCoverUrl = values.videoCoverUrl || null
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
            setEditing(null); 
            form.resetFields(); 
            setMediaType('image');
            setOpen(true) 
          }}
        >
          {t('activities.new_activity')}
        </Button>
      </div>
      <Table 
        rowKey="id" 
        loading={isLoading} 
        dataSource={data || []} 
        columns={columns as any} 
        pagination={{ pageSize: 10 }} 
      />

      <Modal
        title={editing ? t('activities.edit_activity') : t('activities.create_activity')}
        open={open}
        onCancel={() => { 
          setOpen(false); 
          setEditing(null);
          form.resetFields();
          setMediaType('image');
          setUploadProgress(0);
          setIsUploading(false);
        }}
        onOk={handleSubmit}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item 
            name="mediaType" 
            label={t('activities.media_type')}
            initialValue="image"
            rules={[{ required: true, message: t('activities.select_media_type') }]}
          >
            <Radio.Group 
              value={mediaType}
              onChange={(e) => {
                setMediaType(e.target.value);
                form.setFieldsValue({ 
                  imageUrl: null, 
                  videoUrl: null 
                });
                setUploadProgress(0);
                setIsUploading(false);
              }}
            >
              <Radio value="image">{t('activities.image')}</Radio>
              <Radio value="video">{t('activities.video')}</Radio>
            </Radio.Group>
          </Form.Item>

          {mediaType === 'image' ? (
            <Form.Item label={t('activities.image')} required>
              <Space direction="vertical" style={{ width: '100%' }}>
                {form.getFieldValue('imageUrl') ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <Image 
                      src={resolveFileUrlWithBust(form.getFieldValue('imageUrl'))} 
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
                    apiPost<{ imageUrl: string }>('/admin/activities/upload', fd)
                      .then((res) => {
                        form.setFieldsValue({ imageUrl: res.imageUrl })
                        message.success(t('activities.image_uploaded'))
                      })
                      .catch(() => message.error(t('activities.upload_failed')))
                    return false
                  }}
                >
                  <Button icon={<UploadOutlined />}>{t('activities.upload_image')}</Button>
                </Upload>
                <Form.Item 
                  name="imageUrl" 
                  hidden 
                  rules={[{ required: true, message: t('activities.upload_image') }]}
                >
                  <Input />
                </Form.Item>
              </Space>
            </Form.Item>
          ) : (
            <Form.Item label={t('activities.video')} required>
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
                        if (p < 85) {
                          return t('activities.upload_progress', { percent: p })
                        } else if (p < 100) {
                          return t('activities.processing') || 'جاري المعالجة...'
                        } else {
                          return t('activities.completed') || 'اكتمل!'
                        }
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
                    
                    // تتبع تقدم رفع الملف من المتصفح إلى السيرفر (0-85%)
                    xhr.upload.addEventListener('progress', (e) => {
                      if (e.lengthComputable) {
                        // نعرض 85% كحد أقصى لأن السيرفر يحتاج وقت لرفع الملف إلى Cloudinary
                        const percentComplete = Math.round((e.loaded / e.total) * 85)
                        setUploadProgress(percentComplete)
                      }
                    })
                    
                    xhr.addEventListener('load', () => {
                      if (xhr.status === 200 || xhr.status === 201) {
                        try {
                          const res = JSON.parse(xhr.responseText)
                          // عند استلام الاستجابة، نكمل إلى 100% (السيرفر أكمل رفع الملف إلى Cloudinary)
                          setUploadProgress(100)
                          form.setFieldsValue({ 
                            videoUrl: res.videoUrl,
                            videoCoverUrl: res.coverUrl || null
                          })
                          setTimeout(() => {
                            setIsUploading(false)
                            setUploadProgress(0)
                          }, 800)
                          message.success(res.coverUrl ? t('activities.video_uploaded_with_cover') : t('activities.video_uploaded'))
                        } catch (err) {
                          setIsUploading(false)
                          setUploadProgress(0)
                          message.error(t('activities.upload_failed'))
                        }
                      } else {
                        setIsUploading(false)
                        setUploadProgress(0)
                        try {
                          const errorRes = JSON.parse(xhr.responseText)
                          message.error(errorRes.message || t('activities.upload_failed'))
                        } catch {
                          message.error(t('activities.upload_failed'))
                        }
                      }
                    })
                    
                    // عند بدء رفع الملف، نعرض 5% فوراً
                    xhr.addEventListener('loadstart', () => {
                      setUploadProgress(5)
                    })
                    
                    xhr.addEventListener('error', () => {
                      setIsUploading(false)
                      setUploadProgress(0)
                      message.error(t('activities.upload_failed'))
                    })
                    
                    xhr.addEventListener('abort', () => {
                      setIsUploading(false)
                      setUploadProgress(0)
                    })
                    
                    const apiBaseUrl = getApiBase()
                    xhr.open('POST', `${apiBaseUrl}/admin/activities/upload-video`)
                    
                    const token = localStorage.getItem('accessToken') || localStorage.getItem('admin_token') || localStorage.getItem('token')
                    if (token) {
                      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
                    }
                    
                    xhr.send(fd)
                    
                    return false
                  }}
                >
                  <Button icon={<UploadOutlined />} disabled={isUploading}>
                    {isUploading ? t('activities.uploading') : t('activities.upload_video')}
                  </Button>
                </Upload>
                
                <Divider>{t('activities.or')}</Divider>
                
                <Form.Item 
                  name="videoUrl" 
                  rules={[
                    { required: true, message: t('activities.video_url_required') },
                    {
                      pattern: /^https?:\/\/.+/,
                      message: t('activities.enter_valid_url'),
                    },
                  ]}
                >
                  <Input 
                    placeholder={t('activities.enter_video_url')}
                    onChange={(e) => {
                      form.setFieldsValue({ videoUrl: e.target.value });
                    }}
                  />
                </Form.Item>

                <Divider>{t('activities.video_cover')}</Divider>

                <Form.Item label={t('activities.video_cover')}>
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
                        apiPost<{ coverUrl: string }>('/admin/activities/upload-video-cover', fd)
                          .then((res) => {
                            form.setFieldsValue({ videoCoverUrl: res.coverUrl })
                            message.success(t('activities.cover_uploaded'))
                          })
                          .catch((err) => {
                            message.error(err.response?.data?.message || t('activities.upload_failed'))
                          })
                        return false
                      }}
                    >
                      <Button icon={<UploadOutlined />}>{t('activities.upload_cover')}</Button>
                    </Upload>
                    
                    {form.getFieldValue('videoCoverUrl') && (
                      <Button 
                        size="small" 
                        danger
                        onClick={() => {
                          form.setFieldsValue({ videoCoverUrl: null })
                          message.info(t('activities.cover_removed'))
                        }}
                      >
                        {t('activities.remove_cover')}
                      </Button>
                    )}
                    
                    <Form.Item 
                      name="videoCoverUrl" 
                      hidden
                    >
                      <Input />
                    </Form.Item>
                  </Space>
                </Form.Item>
              </Space>
            </Form.Item>
          )}

          <Form.Item 
            name="isActive" 
            label={t('activities.active')}
            valuePropName="checked" 
            initialValue={true}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}





















