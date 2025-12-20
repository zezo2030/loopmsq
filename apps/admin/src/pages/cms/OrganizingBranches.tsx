import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Switch, Table, message, Upload, Image, Space, Radio, Divider } from 'antd'
import { UploadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { resolveFileUrlWithBust } from '../../shared/url'
import { useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../api'

type OrganizingBranch = {
  id: string
  imageUrl?: string | null
  videoUrl?: string | null
  videoCoverUrl?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function OrganizingBranches() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<OrganizingBranch[]>({ 
    queryKey: ['organizing-branches'], 
    queryFn: () => apiGet('/admin/organizing-branches') 
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<OrganizingBranch | null>(null)
  const [form] = Form.useForm()
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [coverUrl, setCoverUrl] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (body: Partial<OrganizingBranch>) => apiPost<OrganizingBranch>('/admin/organizing-branches', body),
      onSuccess: () => { 
      message.success('Organizing Branch created'); 
      qc.invalidateQueries({ queryKey: ['organizing-branches'] }); 
      setOpen(false);
      form.resetFields();
      setMediaType('image');
      setCoverUrl(null);
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<OrganizingBranch> }) => apiPatch(`/admin/organizing-branches/${id}`, body),
      onSuccess: () => { 
      message.success('Organizing Branch updated'); 
      qc.invalidateQueries({ queryKey: ['organizing-branches'] }); 
      setOpen(false); 
      setEditing(null);
      form.resetFields();
      setMediaType('image');
      setCoverUrl(null);
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/organizing-branches/${id}`),
    onSuccess: () => { 
      message.success('Organizing Branch removed'); 
      qc.invalidateQueries({ queryKey: ['organizing-branches'] }) 
    },
  })

  const isCloudinaryVideo = (url: string | null | undefined): boolean => {
    if (!url) return false
    return url.includes('cloudinary.com') || url.includes('res.cloudinary.com')
  }

  const columns = [
    { 
      title: 'Media', 
      dataIndex: 'imageUrl', 
      render: (_: any, r: OrganizingBranch) => {
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
              <span>{isCloudinary ? 'Cloudinary Video' : 'YouTube Video'}</span>
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
      title: 'URL', 
      render: (_: any, r: OrganizingBranch) => {
        if (r.videoUrl) return <a href={r.videoUrl} target="_blank" rel="noopener noreferrer">{r.videoUrl}</a>
        if (r.imageUrl) return <span>{r.imageUrl}</span>
        return '-'
      }
    },
    { title: 'Active', dataIndex: 'isActive', render: (v: boolean) => (v ? 'Yes' : 'No') },
    {
      title: 'Actions', 
      render: (_: any, r: OrganizingBranch) => (
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
              setCoverUrl(r.videoCoverUrl || null)
              setOpen(true) 
            }}
          >
            Edit
          </Button>
          <Button 
            size="small" 
            danger 
            onClick={() => deleteMutation.mutate(r.id)}
          >
            Delete
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button 
          type="primary" 
            onClick={() => { 
            setEditing(null); 
            form.resetFields(); 
            setMediaType('image');
            setCoverUrl(null);
            setOpen(true) 
          }}
        >
          New Organizing Branch
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
        title={editing ? 'Edit Organizing Branch' : 'Create Organizing Branch'}
        open={open}
        onCancel={() => { 
          setOpen(false); 
          setEditing(null);
          form.resetFields();
          setMediaType('image');
          setCoverUrl(null);
        }}
        onOk={handleSubmit}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item 
            name="mediaType" 
            label="Media Type"
            initialValue="image"
            rules={[{ required: true, message: 'Please select media type' }]}
          >
            <Radio.Group 
              value={mediaType}
              onChange={(e) => {
                setMediaType(e.target.value);
                form.setFieldsValue({ 
                  imageUrl: null, 
                  videoUrl: null,
                  videoCoverUrl: null
                });
                setCoverUrl(null);
              }}
            >
              <Radio value="image">Image</Radio>
              <Radio value="video">Video</Radio>
            </Radio.Group>
          </Form.Item>

          {mediaType === 'image' ? (
            <Form.Item label="Image" required>
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
                    apiPost<{ imageUrl: string }>('/admin/organizing-branches/upload', fd)
                      .then((res) => {
                        form.setFieldsValue({ imageUrl: res.imageUrl })
                        message.success('Image uploaded')
                      })
                      .catch(() => message.error('Upload failed'))
                    return false
                  }}
                >
                  <Button icon={<UploadOutlined />}>Upload Image</Button>
                </Upload>
                <Form.Item 
                  name="imageUrl" 
                  hidden 
                  rules={[{ required: true, message: 'Please upload an image' }]}
                >
                  <Input />
                </Form.Item>
              </Space>
            </Form.Item>
          ) : (
            <Form.Item label="Video" required>
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
                
                <Upload
                  accept="video/*"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    const fd = new FormData()
                    fd.append('file', file)
                    apiPost<{ videoUrl: string; coverUrl: string }>('/admin/organizing-branches/upload-video', fd)
                      .then((res) => {
                        console.log('Video upload response:', res)
                        const cover = res.coverUrl || null
                        form.setFieldsValue({ 
                          videoUrl: res.videoUrl,
                          videoCoverUrl: cover
                        })
                        setCoverUrl(cover)
                        message.success('Video uploaded successfully' + (cover ? ' (cover generated automatically)' : ''))
                      })
                      .catch((err) => {
                        console.error('Video upload error:', err)
                        message.error(err.response?.data?.message || 'Upload failed')
                      })
                    return false
                  }}
                >
                  <Button icon={<UploadOutlined />}>Upload Video</Button>
                </Upload>
                
                <Divider>OR</Divider>
                
                <Form.Item 
                  name="videoUrl" 
                  rules={[
                    { required: true, message: 'Please upload a video or enter video URL' },
                    {
                      pattern: /^https?:\/\/.+/,
                      message: 'Please enter a valid URL',
                    },
                  ]}
                >
                  <Input 
                    placeholder="Or enter YouTube/Video URL: https://..." 
                    onChange={(e) => {
                      form.setFieldsValue({ videoUrl: e.target.value });
                    }}
                  />
                </Form.Item>

                <Divider>Video Cover (Optional)</Divider>

                <Form.Item label="Video Cover">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {(coverUrl || form.getFieldValue('videoCoverUrl')) ? (
                      <div>
                        <Image 
                          src={resolveFileUrlWithBust(coverUrl || form.getFieldValue('videoCoverUrl'))} 
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
                        apiPost<{ coverUrl: string }>('/admin/organizing-branches/upload-video-cover', fd)
                          .then((res) => {
                            console.log('Cover upload response:', res)
                            form.setFieldsValue({ videoCoverUrl: res.coverUrl })
                            setCoverUrl(res.coverUrl)
                            message.success('Cover uploaded successfully')
                          })
                          .catch((err) => {
                            console.error('Cover upload error:', err)
                            message.error(err.response?.data?.message || 'Upload failed')
                          })
                        return false
                      }}
                    >
                      <Button icon={<UploadOutlined />}>Upload Cover Image</Button>
                    </Upload>
                    
                    {(coverUrl || form.getFieldValue('videoCoverUrl')) && (
                      <Button 
                        size="small" 
                        danger
                        onClick={() => {
                          form.setFieldsValue({ videoCoverUrl: null })
                          setCoverUrl(null)
                          message.info('Cover removed')
                        }}
                      >
                        Remove Cover
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
            label="Active" 
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

