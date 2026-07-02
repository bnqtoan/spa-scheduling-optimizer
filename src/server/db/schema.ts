import { relations, sql } from 'drizzle-orm'
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// ---------------------------------------------------------------------------
// technicians
// ---------------------------------------------------------------------------
export const technicians = sqliteTable('technicians', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
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
  createdAt: text('created_at')
    .notNull()
    .default(sql`(current_timestamp)`),
}, (t) => [uniqueIndex('bookings_code_unique').on(t.code)])

export const bookingsRelations = relations(bookings, ({ one }) => ({
  technician: one(technicians, {
    fields: [bookings.technicianId],
    references: [technicians.id],
  }),
  service: one(services, {
    fields: [bookings.serviceId],
    references: [services.id],
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
