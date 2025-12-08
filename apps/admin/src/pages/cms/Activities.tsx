import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Switch, Table, message, Upload, Image, Space, Radio } from 'antd'
import { UploadOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { resolveFileUrlWithBust } from '../../shared/url'
import { useState } from 'react'
import { apiDelete, apiGet, apiPatch, apiPost } from '../../api'

type Activity = {
  id: string
  imageUrl?: string | null
  videoUrl?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function Activities() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<Activity[]>({ 
    queryKey: ['activities'], 
    queryFn: () => apiGet('/admin/activities') 
  })
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Activity | null>(null)
  const [form] = Form.useForm()
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')

  const createMutation = useMutation({
    mutationFn: (body: Partial<Activity>) => apiPost<Activity>('/admin/activities', body),
    onSuccess: () => { 
      message.success('Activity created'); 
      qc.invalidateQueries({ queryKey: ['activities'] }); 
      setOpen(false);
      form.resetFields();
      setMediaType('image');
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Activity> }) => apiPatch(`/admin/activities/${id}`, body),
    onSuccess: () => { 
      message.success('Activity updated'); 
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
      message.success('Activity removed'); 
      qc.invalidateQueries({ queryKey: ['activities'] }) 
    },
  })

  const columns = [
    { 
      title: 'Media', 
      dataIndex: 'imageUrl', 
      render: (_: any, r: Activity) => {
        if (r.videoUrl) {
          return (
            <Space>
              <PlayCircleOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <span>YouTube Video</span>
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
      render: (_: any, r: Activity) => {
        if (r.videoUrl) return <a href={r.videoUrl} target="_blank" rel="noopener noreferrer">{r.videoUrl}</a>
        if (r.imageUrl) return <span>{r.imageUrl}</span>
        return '-'
      }
    },
    { title: 'Active', dataIndex: 'isActive', render: (v: boolean) => (v ? 'Yes' : 'No') },
    {
      title: 'Actions', 
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
              }); 
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
      } else {
        body.videoUrl = values.videoUrl || null
        body.imageUrl = null
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
            setOpen(true) 
          }}
        >
          New Activity
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
        title={editing ? 'Edit Activity' : 'Create Activity'}
        open={open}
        onCancel={() => { 
          setOpen(false); 
          setEditing(null);
          form.resetFields();
          setMediaType('image');
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
                  videoUrl: null 
                });
              }}
            >
              <Radio value="image">Image</Radio>
              <Radio value="video">YouTube Video</Radio>
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
                    apiPost<{ imageUrl: string }>('/admin/activities/upload', fd)
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
            <Form.Item 
              name="videoUrl" 
              label="YouTube Video URL"
              rules={[
                { required: true, message: 'Please enter YouTube video URL' },
                {
                  pattern: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
                  message: 'Please enter a valid YouTube URL',
                },
              ]}
            >
              <Input 
                placeholder="https://www.youtube.com/watch?v=..." 
                onChange={(e) => {
                  form.setFieldsValue({ videoUrl: e.target.value });
                }}
              />
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




