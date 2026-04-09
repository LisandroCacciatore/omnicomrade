-- Notification preferences + in-app inbox tables
create table if not exists notification_preferences (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  notify_membership_expiring boolean default true,
  notify_student_inactive boolean default true,
  notify_weekly_summary boolean default true,
  notify_new_program boolean default true,
  notify_unread_messages boolean default true,
  notify_training_reminder boolean default false,
  training_reminder_hour smallint default 8,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(gym_id, profile_id)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete cascade,
  recipient_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  action_url text,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_recipient
  on notifications(recipient_id, created_at desc);

alter table notification_preferences enable row level security;
alter table notifications enable row level security;

do $$ begin
  create policy notification_preferences_own on notification_preferences
    for all using (profile_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy notifications_select_own on notifications
    for select using (recipient_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy notifications_update_own on notifications
    for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
exception when duplicate_object then null; end $$;
