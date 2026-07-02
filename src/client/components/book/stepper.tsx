import { CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export const STEPS = [
  { n: 1, label: 'Chọn dịch vụ' },
  { n: 2, label: 'Khoảng thời gian' },
  { n: 3, label: 'Gợi ý lịch trống' },
  { n: 4, label: 'Thông tin khách hàng' },
  { n: 5, label: 'Xác nhận' },
] as const

export type StepNumber = 1 | 2 | 3 | 4 | 5

/**
 * Left vertical stepper. Current step highlighted; completed steps show a check.
 * On small screens it collapses to a horizontal dot row via CSS.
 */
export function Stepper({ current }: { current: StepNumber }) {
  return (
    <ol className="flex flex-row gap-1 sm:flex-col sm:gap-0">
      {STEPS.map((step, i) => {
        const status =
          step.n < current ? 'done' : step.n === current ? 'active' : 'todo'
        const isLast = i === STEPS.length - 1
        return (
          <li key={step.n} className="flex flex-1 items-center gap-3 sm:flex-none">
            <div className="flex flex-col items-center self-stretch sm:self-auto">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 transition-colors',
                  status === 'done' &&
                    'bg-primary text-primary-foreground ring-primary',
                  status === 'active' &&
                    'bg-primary/10 text-primary ring-primary',
                  status === 'todo' &&
                    'bg-muted text-muted-foreground ring-border',
                )}
              >
                {status === 'done' ? <CheckIcon className="size-4" /> : step.n}
              </span>
              {!isLast && (
                <span
                  className={cn(
                    'hidden w-px flex-1 sm:block',
                    step.n < current ? 'bg-primary' : 'bg-border',
                  )}
                  style={{ minHeight: '1.25rem' }}
                />
              )}
            </div>
            <span
              className={cn(
                'hidden pb-5 text-sm sm:block',
                status === 'active'
                  ? 'font-semibold text-foreground'
                  : status === 'done'
                    ? 'text-foreground/70'
                    : 'text-muted-foreground',
              )}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
