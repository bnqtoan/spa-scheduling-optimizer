import { useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventContentArg, EventInput } from '@fullcalendar/core'
import type { ResourceInput } from '@fullcalendar/resource'
import type { Booking, Technician } from '@/lib/api'
import { minToDate, minToSlot, fmtRange, WORK_START_MIN, WORK_END_MIN } from '@/lib/time'
import { STATUS_COLORS } from './status'

// Free/OSS scheduler license key (FullCalendar premium plugins under GPL).
const LICENSE_KEY = 'GPL-My-Project-Is-Open-Source'

export function TimelineCalendar({
  date,
  technicians,
  bookings,
}: {
  date: string
  technicians: Technician[]
  bookings: Booking[]
}) {
  const resources = useMemo<ResourceInput[]>(
    () =>
      technicians.map((t) => ({
        id: String(t.id),
        title: t.name,
        extendedProps: { skills: t.skills.map((s) => s.name).join(' · ') },
      })),
    [technicians],
  )

  const events = useMemo<EventInput[]>(
    () =>
      bookings.map((b) => {
        const c = STATUS_COLORS[b.status]
        return {
          id: String(b.id),
          resourceId: String(b.technician.id),
          title: b.service.name,
          start: minToDate(b.date, b.startMin),
          end: minToDate(b.date, b.endMin),
          backgroundColor: c.bg,
          borderColor: c.border,
          textColor: c.text,
          extendedProps: {
            startMin: b.startMin,
            endMin: b.endMin,
            customerName: b.customerName,
            serviceName: b.service.name,
          },
        }
      }),
    [bookings],
  )

  return (
    <div className="spa-timeline">
      <FullCalendar
        schedulerLicenseKey={LICENSE_KEY}
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        initialView="resourceTimelineDay"
        initialDate={date}
        headerToolbar={false}
        height="auto"
        locale="vi"
        resourceAreaHeaderContent="Kỹ thuật viên"
        resourceAreaWidth="180px"
        resources={resources}
        events={events}
        slotMinTime={minToSlot(WORK_START_MIN)}
        slotMaxTime={minToSlot(WORK_END_MIN)}
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        nowIndicator
        expandRows
        resourceLabelContent={renderResource}
        eventContent={renderEvent}
      />
    </div>
  )
}

function renderResource(arg: { resource: { title: string; extendedProps: { skills?: string } } }) {
  const skills = arg.resource.extendedProps.skills
  return (
    <div className="flex flex-col py-1 leading-tight">
      <span className="font-medium text-foreground">{arg.resource.title}</span>
      {skills ? <span className="text-[11px] text-muted-foreground">{skills}</span> : null}
    </div>
  )
}

function renderEvent(arg: EventContentArg) {
  const { startMin, endMin, customerName } = arg.event.extendedProps as {
    startMin: number
    endMin: number
    customerName: string
  }
  return (
    <div className="overflow-hidden px-1.5 py-0.5 leading-tight">
      <div className="text-[11px] font-semibold opacity-80">{fmtRange(startMin, endMin)}</div>
      <div className="truncate text-xs font-medium">{arg.event.title}</div>
      <div className="truncate text-[11px] opacity-80">{customerName}</div>
    </div>
  )
}
