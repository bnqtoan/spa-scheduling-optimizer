-- Seed data mirroring the mockup. Idempotent: clears dependent tables first (child -> parent order),
-- then re-inserts. Safe to re-run against local D1.

-- Phase 2 tables cleared first (child -> parent). audit_log & payments reference bookings; sessions -> users.
DELETE FROM audit_log;
DELETE FROM payments;
DELETE FROM sessions;
DELETE FROM users;
DELETE FROM bookings;
DELETE FROM time_off;
DELETE FROM working_hours;
DELETE FROM technician_skills;
DELETE FROM services;
DELETE FROM skills;
DELETE FROM technicians;

-- Reset autoincrement counters so ids are stable across re-seeds.
DELETE FROM sqlite_sequence WHERE name IN ('audit_log','payments','users','bookings','time_off','working_hours','technician_skills','services','skills','technicians');

-- ---------------------------------------------------------------------------
-- skills (id assigned in insertion order: 1 Massage, 2 Facial, 3 Nail, 4 Gội đầu)
-- ---------------------------------------------------------------------------
INSERT INTO skills (id, name) VALUES
  (1, 'Massage'),
  (2, 'Facial'),
  (3, 'Nail'),
  (4, 'Gội đầu');

-- ---------------------------------------------------------------------------
-- technicians (1 Lan Anh, 2 Mai Chi, 3 Thu Hà, 4 Minh Thư, 5 Kim Ngân)
-- ---------------------------------------------------------------------------
INSERT INTO technicians (id, name, avatar_url, email, active) VALUES
  (1, 'Lan Anh', NULL, 'lananh@example.com', 1),
  (2, 'Mai Chi', NULL, 'maichi@example.com', 1),
  (3, 'Thu Hà', NULL, 'thuha@example.com', 1),
  (4, 'Minh Thư', NULL, 'minhthu@example.com', 1),
  (5, 'Kim Ngân', NULL, 'kimngan@example.com', 1);

-- ---------------------------------------------------------------------------
-- technician_skills
-- ---------------------------------------------------------------------------
INSERT INTO technician_skills (technician_id, skill_id) VALUES
  (1, 1), (1, 2),   -- Lan Anh: Massage, Facial
  (2, 3), (2, 2),   -- Mai Chi: Nail, Facial
  (3, 1), (3, 4),   -- Thu Hà: Massage, Gội đầu
  (4, 3), (4, 1),   -- Minh Thư: Nail, Massage
  (5, 2), (5, 4);   -- Kim Ngân: Facial, Gội đầu

-- ---------------------------------------------------------------------------
-- services (id 1..6)
-- ---------------------------------------------------------------------------
INSERT INTO services (id, name, skill_id, duration_min, price, active) VALUES
  (1, 'Massage thư giãn', 1, 60, 450000, 1),
  (2, 'Massage body', 1, 90, 650000, 1),
  (3, 'Facial cơ bản', 2, 60, 400000, 1),
  (4, 'Facial nâng cơ', 2, 75, 600000, 1),
  (5, 'Nail tay', 3, 60, 250000, 1),
  (6, 'Gội đầu dưỡng sinh', 4, 45, 200000, 1);

-- ---------------------------------------------------------------------------
-- working_hours: all 5 techs, every day of week (Mon-Sun), 09:00-19:00 (540-1140)
-- weekday convention: 0=Sunday, 1=Monday, ... 6=Saturday (SQLite strftime('%w') convention)
-- ---------------------------------------------------------------------------
INSERT INTO working_hours (technician_id, weekday, start_min, end_min) VALUES
  (1, 0, 540, 1140), (1, 1, 540, 1140), (1, 2, 540, 1140), (1, 3, 540, 1140), (1, 4, 540, 1140), (1, 5, 540, 1140), (1, 6, 540, 1140),
  (2, 0, 540, 1140), (2, 1, 540, 1140), (2, 2, 540, 1140), (2, 3, 540, 1140), (2, 4, 540, 1140), (2, 5, 540, 1140), (2, 6, 540, 1140),
  (3, 0, 540, 1140), (3, 1, 540, 1140), (3, 2, 540, 1140), (3, 3, 540, 1140), (3, 4, 540, 1140), (3, 5, 540, 1140), (3, 6, 540, 1140),
  (4, 0, 540, 1140), (4, 1, 540, 1140), (4, 2, 540, 1140), (4, 3, 540, 1140), (4, 4, 540, 1140), (4, 5, 540, 1140), (4, 6, 540, 1140),
  (5, 0, 540, 1140), (5, 1, 540, 1140), (5, 2, 540, 1140), (5, 3, 540, 1140), (5, 4, 540, 1140), (5, 5, 540, 1140), (5, 6, 540, 1140);

-- ---------------------------------------------------------------------------
-- bookings: sample bookings for "today" (2026-07-02, Thursday), non-overlapping per technician.
-- NOTE: this date is a fixed seed value, not computed at run time. If "today" has moved on by the
-- time this seed is re-run, re-generate seed.sql (or edit the date column below) so the dashboard
-- timeline has data for the actual current day.
-- Codes follow SPA{yymmdd}-{4-digit seq}.
-- ---------------------------------------------------------------------------
INSERT INTO bookings (code, technician_id, service_id, customer_name, customer_phone, note, date, start_min, end_min, status) VALUES
  ('SPA260702-0001', 1, 1, 'Nguyễn Thị Hoa',   '0901111111', NULL,         '2026-07-02', 570, 630, 'scheduled'),  -- Lan Anh 09:30-10:30
  ('SPA260702-0002', 1, 4, 'Trần Văn Bình',    '0901111112', NULL,         '2026-07-02', 660, 735, 'scheduled'),  -- Lan Anh 11:00-12:15
  ('SPA260702-0003', 2, 5, 'Lê Thị Mai',       '0901111113', NULL,         '2026-07-02', 540, 600, 'scheduled'),  -- Mai Chi 09:00-10:00
  ('SPA260702-0004', 2, 3, 'Phạm Thu Trang',   '0901111114', 'Khách quen', '2026-07-02', 630, 690, 'scheduled'),  -- Mai Chi 10:30-11:30
  ('SPA260702-0005', 3, 2, 'Vũ Thị Lan',       '0901111115', NULL,         '2026-07-02', 600, 690, 'scheduled'),  -- Thu Hà 10:00-11:30
  ('SPA260702-0006', 4, 5, 'Đặng Văn Nam',     '0901111116', NULL,         '2026-07-02', 570, 630, 'completed'),  -- Minh Thư 09:30-10:30
  ('SPA260702-0007', 5, 6, 'Hoàng Thị Yến',    '0901111117', NULL,         '2026-07-02', 690, 735, 'scheduled');  -- Kim Ngân 11:30-12:15

-- ---------------------------------------------------------------------------
-- users (Phase 2 auth). ids 1..7: 1 admin, 1 receptionist, 5 technician users
-- mapped to technicians 1..5. Default password for all = 'spa123'.
-- password_hash below is the real PBKDF2/SHA-256 hash of 'spa123'
-- (pbkdf2$<iters>$<saltB64>$<hashB64>, produced by src/server/lib/auth.ts
-- hashPassword). Salt is random per hash; one shared precomputed string for all
-- users is fine (each still verifies against 'spa123').
-- ---------------------------------------------------------------------------
INSERT INTO users (id, username, password_hash, role, technician_id, active) VALUES
  (1, 'admin', 'pbkdf2$100000$6xokYqdoV1wxMvLb1QgoMw==$PFLehbDcBvILzj3XuIyXwy0ZvaqvN6YCOn9/R8UBBoA=', 'admin',        NULL, 1),
  (2, 'letan', 'pbkdf2$100000$6xokYqdoV1wxMvLb1QgoMw==$PFLehbDcBvILzj3XuIyXwy0ZvaqvN6YCOn9/R8UBBoA=', 'receptionist', NULL, 1),
  (3, 'ktv1',  'pbkdf2$100000$6xokYqdoV1wxMvLb1QgoMw==$PFLehbDcBvILzj3XuIyXwy0ZvaqvN6YCOn9/R8UBBoA=', 'technician',   1,    1),
  (4, 'ktv2',  'pbkdf2$100000$6xokYqdoV1wxMvLb1QgoMw==$PFLehbDcBvILzj3XuIyXwy0ZvaqvN6YCOn9/R8UBBoA=', 'technician',   2,    1),
  (5, 'ktv3',  'pbkdf2$100000$6xokYqdoV1wxMvLb1QgoMw==$PFLehbDcBvILzj3XuIyXwy0ZvaqvN6YCOn9/R8UBBoA=', 'technician',   3,    1),
  (6, 'ktv4',  'pbkdf2$100000$6xokYqdoV1wxMvLb1QgoMw==$PFLehbDcBvILzj3XuIyXwy0ZvaqvN6YCOn9/R8UBBoA=', 'technician',   4,    1),
  (7, 'ktv5',  'pbkdf2$100000$6xokYqdoV1wxMvLb1QgoMw==$PFLehbDcBvILzj3XuIyXwy0ZvaqvN6YCOn9/R8UBBoA=', 'technician',   5,    1);
