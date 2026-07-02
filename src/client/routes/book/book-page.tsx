import { useReducer } from 'react'
import { ArrowLeft, Sparkles } from 'lucide-react'
import type { Service } from '@/lib/api'
import { todayISO } from '@/lib/time'
import {
  useCreateBooking,
  useSuggestSlots,
  type CreatedBooking,
  type SuggestParams,
  type SuggestedSlot,
} from '@/lib/booking-api'
import { Stepper, STEPS, type StepNumber } from '@/components/book/stepper'
import { ServiceStep } from '@/components/book/service-step'
import { WindowStep, type WindowValue } from '@/components/book/window-step'
import { SuggestionsStep } from '@/components/book/suggestions-step'
import { CustomerStep, type CustomerInfo } from '@/components/book/customer-step'
import { ConfirmationStep } from '@/components/book/confirmation-step'
import { hhmmToMin } from '@/components/book/format'

const SUGGEST_LIMIT_STEP = 5
const DEFAULT_WINDOW: WindowValue = {
  date: todayISO(),
  fromHHMM: '09:00',
  toHHMM: '19:00',
}

// ---------------------------------------------------------------------------
// Wizard state machine
// ---------------------------------------------------------------------------

interface State {
  step: StepNumber
  service: Service | null
  window: WindowValue
  limit: number
  slot: SuggestedSlot | null
  customer: CustomerInfo
  booking: CreatedBooking | null
  /** A one-off notice (e.g. the 409 message) shown atop step 3. */
  slotTakenNotice: string | null
}

type Action =
  | { type: 'selectService'; service: Service }
  | { type: 'setWindow'; window: WindowValue }
  | { type: 'search' }
  | { type: 'showMore' }
  | { type: 'pickSlot'; slot: SuggestedSlot }
  | { type: 'setCustomer'; customer: CustomerInfo }
  | { type: 'booked'; booking: CreatedBooking }
  | { type: 'slotTaken' }
  | { type: 'goto'; step: StepNumber }
  | { type: 'reset' }

const initialState: State = {
  step: 1,
  service: null,
  window: DEFAULT_WINDOW,
  limit: SUGGEST_LIMIT_STEP,
  slot: null,
  customer: { name: '', phone: '', note: '' },
  booking: null,
  slotTakenNotice: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'selectService':
      return { ...state, service: action.service, step: 2 }
    case 'setWindow':
      return { ...state, window: action.window }
    case 'search':
      // Reset limit + any stale slot when starting a fresh search.
      return {
        ...state,
        step: 3,
        limit: SUGGEST_LIMIT_STEP,
        slot: null,
        slotTakenNotice: null,
      }
    case 'showMore':
      return { ...state, limit: state.limit + SUGGEST_LIMIT_STEP }
    case 'pickSlot':
      return { ...state, slot: action.slot, step: 4 }
    case 'setCustomer':
      return { ...state, customer: action.customer }
    case 'booked':
      return { ...state, booking: action.booking, step: 5 }
    case 'slotTaken':
      // Slot vanished since suggestion: bounce back to step 3 with a notice.
      return {
        ...state,
        step: 3,
        slot: null,
        slotTakenNotice:
          'Rất tiếc, khung giờ vừa được đặt — vui lòng chọn khung giờ khác.',
      }
    case 'goto':
      return { ...state, step: action.step }
    case 'reset':
      return { ...initialState, window: DEFAULT_WINDOW }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function BookPage() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const { service, window: win, limit, step } = state

  // Suggestion query: enabled only on step 3 with a full param set.
  const suggestParams: SuggestParams | null = service
    ? {
        serviceId: service.id,
        date: win.date,
        from: hhmmToMin(win.fromHHMM),
        to: hhmmToMin(win.toHHMM),
        limit,
      }
    : null
  const suggestQuery = useSuggestSlots(suggestParams, step === 3)

  const createBooking = useCreateBooking()

  function handleSubmit() {
    if (!service || !state.slot) return
    createBooking.reset()
    createBooking.mutate(
      {
        technicianId: state.slot.technicianId,
        serviceId: service.id,
        date: win.date,
        startMin: state.slot.startMin,
        customerName: state.customer.name.trim(),
        customerPhone: state.customer.phone.trim(),
        note: state.customer.note.trim() || undefined,
      },
      {
        onSuccess: (booking) => dispatch({ type: 'booked', booking }),
        onError: (err) => {
          if (err.status === 409) {
            createBooking.reset()
            dispatch({ type: 'slotTaken' })
            void suggestQuery.refetch()
          }
          // Other errors stay on step 4 and surface via createBooking.error.
        },
      },
    )
  }

  // Non-409 create error message for step 4.
  const createErrorMessage =
    createBooking.isError && createBooking.error?.status !== 409
      ? 'Đặt lịch không thành công. Vui lòng thử lại.'
      : null

  const current = STEPS.find((s) => s.n === step)!
  const canGoBack = step > 1 && step < 5

  return (
    <div className="min-h-svh bg-gradient-to-b from-accent/30 via-background to-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        {/* Brand header */}
        <header className="mb-8 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="font-heading text-lg font-semibold text-foreground">
              Spa Serenity
            </p>
            <p className="text-xs text-muted-foreground">Đặt lịch hẹn trực tuyến</p>
          </div>
        </header>

        <div className="grid gap-8 sm:grid-cols-[200px_1fr]">
          {/* Left stepper */}
          <aside className="sm:pt-2">
            <Stepper current={step} />
          </aside>

          {/* Step panel */}
          <section className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm backdrop-blur-sm sm:p-7">
            <div className="mb-5 flex items-center gap-2">
              {canGoBack && (
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: 'goto', step: (step - 1) as StepNumber })
                  }
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Quay lại"
                >
                  <ArrowLeft className="size-4" />
                </button>
              )}
              <div>
                <p className="text-xs font-medium text-primary">
                  Bước {step}/5
                </p>
                <h1 className="font-heading text-xl font-semibold text-foreground">
                  {current.label}
                </h1>
              </div>
            </div>

            {step === 1 && (
              <ServiceStep
                selectedId={service?.id ?? null}
                onSelect={(s) => dispatch({ type: 'selectService', service: s })}
              />
            )}

            {step === 2 && service && (
              <WindowStep
                service={service}
                value={win}
                onChange={(w) => dispatch({ type: 'setWindow', window: w })}
                onSearch={() => dispatch({ type: 'search' })}
              />
            )}

            {step === 3 && (
              <div className="flex flex-col gap-3">
                {state.slotTakenNotice && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {state.slotTakenNotice}
                  </p>
                )}
                <SuggestionsStep
                  query={{
                    data: suggestQuery.data,
                    isLoading: suggestQuery.isLoading,
                    isError: suggestQuery.isError,
                    error: suggestQuery.error ?? null,
                    refetch: () => void suggestQuery.refetch(),
                  }}
                  onPick={(slot) => dispatch({ type: 'pickSlot', slot })}
                  onShowMore={() => dispatch({ type: 'showMore' })}
                  canShowMore={
                    (suggestQuery.data?.slots.length ?? 0) >= limit
                  }
                  isFetchingMore={suggestQuery.isFetching && !suggestQuery.isLoading}
                />
              </div>
            )}

            {step === 4 && (
              <CustomerStep
                value={state.customer}
                onChange={(c) => dispatch({ type: 'setCustomer', customer: c })}
                onSubmit={handleSubmit}
                isSubmitting={createBooking.isPending}
                errorMessage={createErrorMessage}
              />
            )}

            {step === 5 && state.booking && (
              <ConfirmationStep
                booking={state.booking}
                onReset={() => dispatch({ type: 'reset' })}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
