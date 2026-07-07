import { relations, sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// ---------------------------------------------------------------------------
// technicians
// ---------------------------------------------------------------------------
export const technicians = sqliteTable('technicians', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  email: text('email'), // Phase 2 — notification recipient; nullable (existing techs may lack one)
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
})

export const techniciansRelations = relations(technicians, ({ many }) => ({
  technicianSkills: many(technicianSkills),
  workingHours: many(workingHours),
  timeOff: many(timeOff),
  bookings: many(bookings),
}))

// ---------------------------------------------------------------------------
// skills
// ---------------------------------------------------------------------------
export const skills = sqliteTable('skills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
}, (t) => [uniqueIndex('skills_name_unique').on(t.name)])

export const skillsRelations = relations(skills, ({ many }) => ({
  technicianSkills: many(technicianSkills),
  services: many(services),
}))

// ---------------------------------------------------------------------------
// technician_skills (many-to-many)
// ---------------------------------------------------------------------------
export const technicianSkills = sqliteTable('technician_skills', {
  technicianId: integer('technician_id')
    .notNull()
    .references(() => technicians.id, { onDelete: 'cascade' }),
  skillId: integer('skill_id')
    .notNull()
    .references(() => skills.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.technicianId, t.skillId] })])

export const technicianSkillsRelations = relations(technicianSkills, ({ one }) => ({
  technician: one(technicians, {
    fields: [technicianSkills.technicianId],
    references: [technicians.id],
  }),
  skill: one(skills, {
    fields: [technicianSkills.skillId],
    references: [skills.id],
  }),
}))

// ---------------------------------------------------------------------------
// services
// ---------------------------------------------------------------------------
export const services = sqliteTable('services', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  skillId: integer('skill_id')
    .notNull()
    .references(() => skills.id),
  durationMin: integer('duration_min').notNull(),
  price: integer('price').notNull(), // VND
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

export const servicesRelations = relations(services, ({ one, many }) => ({
  skill: one(skills, {
    fields: [services.skillId],
    references: [skills.id],
  }),
  bookings: many(bookings),
}))

// ---------------------------------------------------------------------------
// working_hours
// ---------------------------------------------------------------------------
export const workingHours = sqliteTable('working_hours', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  technicianId: integer('technician_id')
    .notNull()
    .references(() => technicians.id, { onDelete: 'cascade' }),
  weekday: integer('weekday').notNull(), // 0-6, 0 = Sunday
  startMin: integer('start_min').notNull(), // minutes from midnight
  endMin: integer('end_min').notNull(),
})

export const workingHoursRelations = relations(workingHours, ({ one }) => ({
  technician: one(technicians, {
    fields: [workingHours.technicianId],
    references: [technicians.id],
  }),
}))

// ---------------------------------------------------------------------------
// time_off
// ---------------------------------------------------------------------------
export const timeOff = sqliteTable('time_off', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  technicianId: integer('technician_id')
    .notNull()
    .references(() => technicians.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // ISO yyyy-mm-dd
  // null start/end => whole day off
  startMin: integer('start_min'),
  endMin: integer('end_min'),
  reason: text('reason'),
})

export const timeOffRelations = relations(timeOff, ({ one }) => ({
  technician: one(technicians, {
    fields: [timeOff.technicianId],
    references: [technicians.id],
  }),
}))

// ---------------------------------------------------------------------------
// bookings
// ---------------------------------------------------------------------------
export const bookingStatusValues = ['scheduled', 'completed', 'cancelled'] as const
export type BookingStatus = (typeof bookingStatusValues)[number]

export const paymentStatusValues = ['unpaid', 'paid'] as const
export type PaymentStatus = (typeof paymentStatusValues)[number]

export const bookings = sqliteTable('bookings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull(), // e.g. SPA240525-0012
  technicianId: integer('technician_id')
    .notNull()
    .references(() => technicians.id),
  serviceId: integer('service_id')
    .notNull()
    .references(() => services.id),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  note: text('note'),
  date: text('date').notNull(), // yyyy-mm-dd
  startMin: integer('start_min').notNull(),
  endMin: integer('end_min').notNull(),
  status: text('status', { enum: bookingStatusValues }).notNull().default('scheduled'),
  // Phase 2 payment columns (denormalized for fast list queries)
  paymentStatus: text('payment_status', { enum: paymentStatusValues }).notNull().default('unpaid'),
  paymentRef: text('payment_ref'), // denormalized; also stored in payments — for QR display + quick lookup
  createdByUserId: integer('created_by_user_id').references(() => users.id), // null = customer
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
}, (t) => [uniqueIndex('bookings_code_unique').on(t.code)])

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  technician: one(technicians, {
    fields: [bookings.technicianId],
    references: [technicians.id],
  }),
  service: one(services, {
    fields: [bookings.serviceId],
    references: [services.id],
  }),
  createdByUser: one(users, {
    fields: [bookings.createdByUserId],
    references: [users.id],
  }),
  payments: many(payments),
  auditLogs: many(auditLog),
}))

// ---------------------------------------------------------------------------
// users (Phase 2 — auth)
// ---------------------------------------------------------------------------
export const userRoleValues = ['admin', 'receptionist', 'technician'] as const
export type UserRole = (typeof userRoleValues)[number]

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: userRoleValues }).notNull(),
  technicianId: integer('technician_id').references(() => technicians.id), // only set for role=technician
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
}, (t) => [uniqueIndex('users_username_unique').on(t.username)])

export const usersRelations = relations(users, ({ one, many }) => ({
  technician: one(technicians, {
    fields: [users.technicianId],
    references: [technicians.id],
  }),
  sessions: many(sessions),
}))

// ---------------------------------------------------------------------------
// sessions (Phase 2 — auth; id is an opaque app-set token, NOT autoincrement)
// ---------------------------------------------------------------------------
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at').notNull(), // unix epoch seconds
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
})

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

// ---------------------------------------------------------------------------
// payments (Phase 2 — SePay / cash)
// ---------------------------------------------------------------------------
export const paymentMethodValues = ['sepay', 'cash'] as const
export type PaymentMethod = (typeof paymentMethodValues)[number]

export const paymentTxStatusValues = ['pending', 'paid', 'failed'] as const
export type PaymentTxStatus = (typeof paymentTxStatusValues)[number]

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookingId: integer('booking_id')
    .notNull()
    .references(() => bookings.id),
  paymentRef: text('payment_ref').notNull(), // A-Z0-9 only, e.g. SPA0012AB — the VietQR transfer content
  amount: integer('amount').notNull(), // VND
  method: text('method', { enum: paymentMethodValues }).notNull().default('sepay'),
  status: text('status', { enum: paymentTxStatusValues }).notNull().default('pending'),
  sepayTxId: text('sepay_tx_id'), // SePay transaction id from webhook
  rawPayload: text('raw_payload'), // JSON string of the SePay webhook body, for reconciliation
  paidAt: text('paid_at'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
}, (t) => [uniqueIndex('payments_payment_ref_unique').on(t.paymentRef)])

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
}))

// ---------------------------------------------------------------------------
// audit_log (Phase 2)
// ---------------------------------------------------------------------------
export const auditActionValues = ['create', 'update', 'cancel', 'pay'] as const
export type AuditAction = (typeof auditActionValues)[number]

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  bookingId: integer('booking_id').references(() => bookings.id),
  userId: integer('user_id').references(() => users.id), // null = customer self-service
  action: text('action', { enum: auditActionValues }).notNull(),
  oldValues: text('old_values'), // JSON string
  newValues: text('new_values'), // JSON string
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
})

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  booking: one(bookings, {
    fields: [auditLog.bookingId],
    references: [bookings.id],
  }),
  user: one(users, {
    fields: [auditLog.userId],
    references: [users.id],
  }),
}))

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Technician = typeof technicians.$inferSelect
export type NewTechnician = typeof technicians.$inferInsert

export type Skill = typeof skills.$inferSelect
export type NewSkill = typeof skills.$inferInsert

export type TechnicianSkill = typeof technicianSkills.$inferSelect
export type NewTechnicianSkill = typeof technicianSkills.$inferInsert

export type Service = typeof services.$inferSelect
export type NewService = typeof services.$inferInsert

export type WorkingHours = typeof workingHours.$inferSelect
export type NewWorkingHours = typeof workingHours.$inferInsert

export type TimeOff = typeof timeOff.$inferSelect
export type NewTimeOff = typeof timeOff.$inferInsert

export type Booking = typeof bookings.$inferSelect
export type NewBooking = typeof bookings.$inferInsert

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert

export type AuditLog = typeof auditLog.$inferSelect
export type NewAuditLog = typeof auditLog.$inferInsert
