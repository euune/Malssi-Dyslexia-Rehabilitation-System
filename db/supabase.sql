-- ============================================================
-- 말씨 데이터베이스 (Supabase / PostgreSQL)
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여 넣고 Run 하세요.
-- 여러 번 실행해도 안전해요 (이미 있는 테이블·데이터는 그대로 둠).
--
-- 보안 구조
--  - 웹페이지에 들어가는 공개 키(anon key)로는 테이블을 직접 읽고 쓸 수 없어요 (RLS 켜고 권한 회수).
--  - 아래 malssi_* 함수만 공개 키로 부를 수 있고, 함수는 "학습 기록 코드"를 알아야 그 아이의 기록만 다뤄요.
--  - 선생님·치료사는 Supabase 대시보드(Table Editor / SQL Editor)에서 모든 기록을 봐요.
-- ============================================================

-- 학습자: 아이 한 명 = 한 줄. code 는 아이가 다른 기기에서 이어 하기 위한 8자리 코드
create table if not exists public.learners (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  seed_name    text check (char_length(seed_name) <= 30),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- 현재 상태: 게임이 브라우저에 저장하던 내용 전체 (씨앗 이름, 경험치, 보류 목록, 설정, 동화 진행 …)
create table if not exists public.learner_state (
  learner_id uuid primary key references public.learners(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  exp        integer not null default 0,           -- 자주 보는 값은 따로 꺼내 둠
  updated_at timestamptz not null default now()
);

-- 과제 기록: 과제를 끝내거나(도달) 보류할 때마다 한 줄
create table if not exists public.activity_history (
  id         bigint generated always as identity primary key,
  learner_id uuid not null references public.learners(id) on delete cascade,
  activity   text not null,                         -- read-word, read-sentence, write-word, write-sentence …
  item_id    text,                                  -- 낱말·문장 번호
  attempts   integer,                               -- 시도 횟수
  retries    integer,                               -- 다시 하기 횟수
  reached    boolean,                               -- 목표 도달
  held       boolean,                               -- 보류
  ms         integer,                               -- 걸린 시간(ms)
  done_at    timestamptz not null default now()
);
create index if not exists activity_history_learner_time on public.activity_history (learner_id, done_at);

-- 헷갈린 자소 기록: 목표 자소와 실제로 들린/쓴 자소 (예: ㅏ → ㅓ)
create table if not exists public.confusion_log (
  id          bigint generated always as identity primary key,
  learner_id  uuid not null references public.learners(id) on delete cascade,
  target_jamo text not null,
  heard_jamo  text,
  created_at  timestamptz not null default now()
);
create index if not exists confusion_log_learner on public.confusion_log (learner_id, target_jamo);

-- 공개 키로는 테이블에 직접 접근 불가
alter table public.learners         enable row level security;
alter table public.learner_state    enable row level security;
alter table public.activity_history enable row level security;
alter table public.confusion_log    enable row level security;
revoke all on public.learners, public.learner_state, public.activity_history, public.confusion_log from anon, authenticated;

-- ---------------- 함수 (공개 키로 부르는 유일한 입구) ----------------

-- 코드 → 학습자 id (내부용)
create or replace function public.malssi_learner_id(p_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.learners where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- 새 학습자 만들기 → 학습 기록 코드 돌려줌
create or replace function public.malssi_register(p_seed_name text default null)
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_code text;
  v_id   uuid;
  v_b    bytea;
begin
  loop
    -- 헷갈리는 글자(0 O 1 I)를 뺀 32글자 중 8자리, 안전한 난수(gen_random_uuid) 사용
    v_b := uuid_send(gen_random_uuid());
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (get_byte(v_b, i) % 32) + 1, 1), '' order by n)
      into v_code
      from unnest(array[0, 1, 2, 3, 4, 5, 10, 11]) with ordinality as t(i, n);
    begin
      insert into public.learners (code, seed_name) values (v_code, left(p_seed_name, 30)) returning id into v_id;
      exit;
    exception when unique_violation then
      -- 드물게 코드가 겹치면 다시 뽑기
    end;
  end loop;
  insert into public.learner_state (learner_id) values (v_id);
  return v_code;
end $$;

-- 저장된 상태 불러오기 (없는 코드면 null)
create or replace function public.malssi_load(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_id  uuid := public.malssi_learner_id(p_code);
  v_out jsonb;
begin
  if v_id is null then return null; end if;
  update public.learners set last_seen_at = now() where id = v_id;
  select jsonb_build_object('data', s.data, 'updated_at', s.updated_at)
    into v_out from public.learner_state s where s.learner_id = v_id;
  return v_out;
end $$;

-- 상태 저장 → 저장 시각 돌려줌
create or replace function public.malssi_save(p_code text, p_data jsonb)
returns timestamptz language plpgsql volatile security definer set search_path = public as $$
declare
  v_id   uuid := public.malssi_learner_id(p_code);
  v_at   timestamptz := clock_timestamp();
  v_game jsonb;
begin
  if v_id is null then raise exception 'unknown learner code' using errcode = 'P0002'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'data must be an object'; end if;
  if pg_column_size(p_data) > 500000 then raise exception 'data too large'; end if;
  v_game := p_data -> 'seed-garden-v1';
  update public.learner_state
     set data = p_data,
         exp = case when jsonb_typeof(v_game -> 'exp') = 'number' then (v_game ->> 'exp')::numeric::integer else exp end,
         updated_at = v_at
   where learner_id = v_id;
  update public.learners
     set last_seen_at = v_at,
         seed_name = case when jsonb_typeof(v_game -> 'seedName') = 'string' then left(v_game ->> 'seedName', 30) else seed_name end
   where id = v_id;
  return v_at;
end $$;

-- 과제 기록 여러 줄 한 번에 저장 (최대 200줄)
create or replace function public.malssi_log_history(p_code text, p_rows jsonb)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  v_id uuid := public.malssi_learner_id(p_code);
  v_n  integer;
begin
  if v_id is null then raise exception 'unknown learner code' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be an array'; end if;
  insert into public.activity_history (learner_id, activity, item_id, attempts, retries, reached, held, ms, done_at)
  select v_id, left(x.activity, 40), left(x.id, 60), x.attempts, x.retries, x.reached, x.held, x.ms, coalesce(x.at, now())
    from (select * from jsonb_to_recordset(p_rows)
            as r(activity text, id text, attempts integer, retries integer, reached boolean, held boolean, ms integer, at timestamptz)
           limit 200) x
   where x.activity is not null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- 헷갈린 자소 여러 개 한 번에 저장 (최대 200개)
create or replace function public.malssi_log_confusion(p_code text, p_rows jsonb)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  v_id uuid := public.malssi_learner_id(p_code);
  v_n  integer;
begin
  if v_id is null then raise exception 'unknown learner code' using errcode = 'P0002'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'rows must be an array'; end if;
  insert into public.confusion_log (learner_id, target_jamo, heard_jamo, created_at)
  select v_id, left(x.target, 8), left(x.heard, 8), coalesce(x.at, now())
    from (select * from jsonb_to_recordset(p_rows) as r(target text, heard text, at timestamptz) limit 200) x
   where x.target is not null and x.target <> '';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- 함수 실행 권한: malssi_learner_id 는 내부용이라 공개하지 않음
revoke execute on function public.malssi_learner_id(text) from public, anon, authenticated;
revoke execute on function public.malssi_register(text), public.malssi_load(text), public.malssi_save(text, jsonb),
                           public.malssi_log_history(text, jsonb), public.malssi_log_confusion(text, jsonb) from public;
grant  execute on function public.malssi_register(text), public.malssi_load(text), public.malssi_save(text, jsonb),
                           public.malssi_log_history(text, jsonb), public.malssi_log_confusion(text, jsonb) to anon, authenticated;

-- ---------------- 선생님·치료사용 보기 (대시보드 SQL Editor 에서 사용) ----------------
-- security_invoker: 공개 키로는 이 보기도 읽을 수 없음

-- 아이별 요약
create or replace view public.malssi_learner_summary with (security_invoker = true) as
select l.code, l.seed_name, s.exp, l.created_at, l.last_seen_at,
       count(h.id)                              as tasks,
       count(h.id) filter (where h.reached)     as reached,
       count(h.id) filter (where h.held)        as held,
       round(avg(h.attempts) filter (where h.reached), 2) as avg_attempts_to_reach
  from public.learners l
  left join public.learner_state s on s.learner_id = l.id
  left join public.activity_history h on h.learner_id = l.id
 group by l.id, l.code, l.seed_name, s.exp, l.created_at, l.last_seen_at;

-- 아이별 자주 헷갈리는 자소 쌍
create or replace view public.malssi_confusion_top with (security_invoker = true) as
select l.code, l.seed_name, c.target_jamo, coalesce(c.heard_jamo, '∅') as heard_jamo, count(*) as times
  from public.confusion_log c join public.learners l on l.id = c.learner_id
 group by l.code, l.seed_name, c.target_jamo, c.heard_jamo;

revoke all on public.malssi_learner_summary, public.malssi_confusion_top from anon, authenticated;
