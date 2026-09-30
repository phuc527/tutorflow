-- =============================================================================
-- TutorFlow local development seed. DO NOT run against production.
-- =============================================================================
-- Creates teacher and student RECORDS plus assignments. It deliberately creates NO logins and
-- NO passwords. To log in as a seeded teacher, create an auth user with the same email
-- (Dashboard → Authentication → Users → Add user). The on_auth_user_created trigger links it
-- to the teacher record automatically. See README → "Create the first admin" for the admin account.
--
-- Safe to re-run: fixed ids + ON CONFLICT DO NOTHING.

insert into public.teachers (id, full_name, email, phone, specialization, hourly_rate, status) values
  ('11111111-1111-4111-8111-000000000001', 'Nguyễn Văn An',  'teacher1@example.com', '0901 234 561', 'Mathematics', 250000, 'active'),
  ('11111111-1111-4111-8111-000000000002', 'Trần Thị Bình',  'teacher2@example.com', '0901 234 562', 'English',     300000, 'active'),
  ('11111111-1111-4111-8111-000000000003', 'Lê Minh Châu',   'teacher3@example.com', '0901 234 563', 'Physics',     280000, 'on_leave')
on conflict (id) do nothing;

insert into public.students (id, full_name, email, phone, parent_name, parent_phone, grade, status, notes) values
  ('22222222-2222-4222-8222-000000000001', 'Phạm Gia Huy',     null,                 '0912 000 001', 'Phạm Văn Hải',   '0987 000 001', 9,  'active',   'Preparing for grade-10 entrance exam'),
  ('22222222-2222-4222-8222-000000000002', 'Võ Ngọc Lan',      'lan.vo@example.com', null,           'Võ Thị Mai',     '0987 000 002', 11, 'active',   null),
  ('22222222-2222-4222-8222-000000000003', 'Đặng Quốc Bảo',    null,                 null,           'Đặng Văn Tùng',  '0987 000 003', 7,  'active',   null),
  ('22222222-2222-4222-8222-000000000004', 'Hoàng Thu Trang',  null,                 '0912 000 004', 'Hoàng Văn Nam',  '0987 000 004', 12, 'active',   'IELTS target 7.0'),
  ('22222222-2222-4222-8222-000000000005', 'Bùi Anh Khoa',     null,                 null,           'Bùi Thị Hoa',    '0987 000 005', 10, 'active',   null),
  ('22222222-2222-4222-8222-000000000006', 'Ngô Minh Thư',     null,                 null,           'Ngô Văn Lợi',    '0987 000 006', 8,  'inactive', 'Paused for summer')
on conflict (id) do nothing;

insert into public.teacher_students (teacher_id, student_id) values
  ('11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000001'),
  ('11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000003'),
  ('11111111-1111-4111-8111-000000000001', '22222222-2222-4222-8222-000000000005'),
  ('11111111-1111-4111-8111-000000000002', '22222222-2222-4222-8222-000000000002'),
  ('11111111-1111-4111-8111-000000000002', '22222222-2222-4222-8222-000000000004'),
  ('11111111-1111-4111-8111-000000000002', '22222222-2222-4222-8222-000000000001'),
  ('11111111-1111-4111-8111-000000000003', '22222222-2222-4222-8222-000000000006')
on conflict (teacher_id, student_id) do nothing;
