import React from 'react'
import { Row, Col, Checkbox, TimePicker, Space, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import dayjs from 'dayjs'

const { Text } = Typography

interface WorkingHoursEditorProps {
  value?: { [key: string]: { open: string; close: string; closed?: boolean } }
  onChange?: (value: { [key: string]: { open: string; close: string; closed?: boolean } }) => void
}

const WorkingHoursEditor: React.FC<WorkingHoursEditorProps> = ({ value = {}, onChange }) => {
  const { t } = useTranslation()

  const daysOfWeek = [
    { key: 'sunday', label: t('working_hours.sunday') || 'Sunday' },
    { key: 'monday', label: t('working_hours.monday') || 'Monday' },
    { key: 'tuesday', label: t('working_hours.tuesday') || 'Tuesday' },
    { key: 'wednesday', label: t('working_hours.wednesday') || 'Wednesday' },
    { key: 'thursday', label: t('working_hours.thursday') || 'Thursday' },
    { key: 'friday', label: t('working_hours.friday') || 'Friday' },
    { key: 'saturday', label: t('working_hours.saturday') || 'Saturday' },
  ]

  const handleDayChange = (dayKey: string, field: 'enabled' | 'closed' | 'open' | 'close', newValue: any) => {
    const newWorkingHours = { ...value }
    
    if (!newWorkingHours[dayKey]) {
      newWorkingHours[dayKey] = { open: '09:00', close: '18:00', closed: false }
    }

    if (field === 'enabled') {
      if (newValue) {
        // Enable the day
        newWorkingHours[dayKey] = { open: '09:00', close: '18:00', closed: false }
      } else {
        // Disable the day
        delete newWorkingHours[dayKey]
      }
    } else if (field === 'closed') {
      newWorkingHours[dayKey].closed = newValue
    } else if (field === 'open') {
      newWorkingHours[dayKey].open = newValue ? newValue.format('HH:mm') : '09:00'
    } else if (field === 'close') {
      newWorkingHours[dayKey].close = newValue ? newValue.format('HH:mm') : '18:00'
    }

    onChange?.(newWorkingHours)
  }

  const isDayEnabled = (dayKey: string) => {
    return value[dayKey] !== undefined
  }

  const isDayClosed = (dayKey: string) => {
    return value[dayKey]?.closed === true
  }

  return (
    <div>
      <Text strong style={{ marginBottom: '16px', display: 'block' }}>
        {t('working_hours.days') || 'Days'}
      </Text>
      <Space direction="vertical" style={{ width: '100%' }}>
        {daysOfWeek.map((day) => (
          <Row key={day.key} gutter={[16, 8]} align="middle">
            <Col xs={24} sm={6}>
              <Checkbox
                checked={isDayEnabled(day.key)}
                onChange={(e) => handleDayChange(day.key, 'enabled', e.target.checked)}
              >
                {day.label}
              </Checkbox>
            </Col>
            {isDayEnabled(day.key) && (
              <>
                <Col xs={24} sm={6}>
                  <Checkbox
                    checked={isDayClosed(day.key)}
                    onChange={(e) => handleDayChange(day.key, 'closed', e.target.checked)}
                  >
                    {t('working_hours.closed') || 'Closed'}
                  </Checkbox>
                </Col>
                {!isDayClosed(day.key) && (
                  <>
                    <Col xs={12} sm={6}>
                      <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                        {t('working_hours.open') || 'Open'}
                      </Text>
                      <TimePicker
                        value={value[day.key]?.open ? dayjs(value[day.key].open, 'HH:mm') : dayjs('09:00', 'HH:mm')}
                        onChange={(time) => handleDayChange(day.key, 'open', time)}
                        format="HH:mm"
                        style={{ width: '100%' }}
                        size="small"
                      />
                    </Col>
                    <Col xs={12} sm={6}>
                      <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                        {t('working_hours.close') || 'Close'}
                      </Text>
                      <TimePicker
                        value={value[day.key]?.close ? dayjs(value[day.key].close, 'HH:mm') : dayjs('18:00', 'HH:mm')}
                        onChange={(time) => handleDayChange(day.key, 'close', time)}
                        format="HH:mm"
                        style={{ width: '100%' }}
                        size="small"
                      />
                    </Col>
                  </>
                )}
              </>
            )}
          </Row>
        ))}
      </Space>
    </div>
  )
}

export default WorkingHoursEditor
