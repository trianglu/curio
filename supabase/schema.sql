-- Run this in Supabase SQL Editor to enable cloud sync + push subscriptions

create table if not exists user_learning_data (
  user_id uuid references auth.users on delete cascade primary key,
  active_path_id text,
  paths jsonb not null default '[]',
  review_cards jsonb not null default '[]',
  notification_settings jsonb not null default '{"passiveLessonReady":true,"reviewReminders":true,"dailyReminderHour":9}',
  updated_at timestamptz not null default now()
);

alter table user_learning_data enable row level security;

create policy "Users can read own data"
  on user_learning_data for select
  using (auth.uid() = user_id);

create policy "Users can upsert own data"
  on user_learning_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on user_learning_data for update
  using (auth.uid() = user_id);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

alter table push_subscriptions enable row level security;

create policy "Users manage own push subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
