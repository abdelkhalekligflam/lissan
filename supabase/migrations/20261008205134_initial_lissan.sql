-- Lissan: RLS by default. Scoring writes are reserved to the verified server.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '' check (char_length(name)<=60),
 language text not null default 'es' check (language in ('es','en','fr')),
 locale text not null default 'ar' check (locale in ('ar','en','fr')),
 goal integer not null default 10 check (goal in (5,10,20)),
 level text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
 xp integer not null default 0 check (xp>=0), created_at timestamptz not null default now()
);
create table public.languages (id text primary key check (id in ('es','en','fr')),name text not null);
create table public.units (id text primary key,language_id text not null references public.languages(id),title text not null,position integer not null check(position>0),unique(language_id,position));
create table public.lessons (id text primary key,unit_id text not null references public.units(id),title text not null,words jsonb not null check(jsonb_typeof(words)='array'),position integer not null check(position>0));
-- Answer keys are computed in the server's immutable curriculum, never supplied by clients.
create table public.exercises (id text primary key,lesson_id text not null references public.lessons(id),type text not null check(type in ('choice','fill','build')),prompt text not null,options jsonb not null default '[]',position integer not null);
create table public.user_progress (user_id uuid not null references public.profiles(id) on delete cascade,lesson_id text not null references public.lessons(id),score integer not null check(score between 0 and 100),xp integer not null check(xp between 0 and 40),completed_at timestamptz not null default now(),primary key(user_id,lesson_id));
create table public.flashcards (id text primary key,lesson_id text not null references public.lessons(id),word text not null,translation text not null,example text not null);
create table public.flashcard_reviews (user_id uuid not null references public.profiles(id) on delete cascade,card_id text not null references public.flashcards(id),interval integer not null default 0 check(interval between 0 and 60),due timestamptz not null default now(),reviewed_at timestamptz not null default now(),primary key(user_id,card_id));
create table public.game_scores (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,kind text not null check(kind in ('matching','speed','memory')),score integer not null check(score between 0 and 40),created_at timestamptz not null default now());
create table public.achievements (id text primary key,name text not null,description text not null);
create table public.user_achievements (user_id uuid not null references public.profiles(id) on delete cascade,achievement_id text not null references public.achievements(id),earned_at timestamptz not null default now(),primary key(user_id,achievement_id));
create table public.streaks (user_id uuid not null references public.profiles(id) on delete cascade,day date not null,xp integer not null check(xp>=0),primary key(user_id,day));

alter table public.profiles enable row level security;
alter table public.languages enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;
alter table public.exercises enable row level security;
alter table public.user_progress enable row level security;
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;
alter table public.game_scores enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.streaks enable row level security;

create policy profiles_read_own on public.profiles for select to authenticated using((select auth.uid())=id);
create policy profiles_update_own on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy languages_read on public.languages for select to authenticated using(true);
create policy units_read on public.units for select to authenticated using(true);
create policy lessons_read on public.lessons for select to authenticated using(true);
create policy exercises_read on public.exercises for select to authenticated using(true);
create policy flashcards_read on public.flashcards for select to authenticated using(true);
create policy achievements_read on public.achievements for select to authenticated using(true);
create policy progress_read_own on public.user_progress for select to authenticated using((select auth.uid())=user_id);
create policy reviews_read_own on public.flashcard_reviews for select to authenticated using((select auth.uid())=user_id);
create policy games_read_own on public.game_scores for select to authenticated using((select auth.uid())=user_id);
create policy earned_read_own on public.user_achievements for select to authenticated using((select auth.uid())=user_id);
create policy streaks_read_own on public.streaks for select to authenticated using((select auth.uid())=user_id);
-- No client INSERT/UPDATE policies for score-bearing rows. The rate-limited API is the only writer.
revoke all on public.profiles,public.languages,public.units,public.lessons,public.exercises,public.user_progress,public.flashcards,public.flashcard_reviews,public.game_scores,public.achievements,public.user_achievements,public.streaks from anon,authenticated;
grant select on public.profiles,public.languages,public.units,public.lessons,public.exercises,public.user_progress,public.flashcards,public.flashcard_reviews,public.game_scores,public.achievements,public.user_achievements,public.streaks to authenticated;
grant update(name,language,locale,goal,level) on public.profiles to authenticated;
grant all on public.profiles,public.languages,public.units,public.lessons,public.exercises,public.user_progress,public.flashcards,public.flashcard_reviews,public.game_scores,public.achievements,public.user_achievements,public.streaks to service_role;

create function private.create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Only invoked by the trusted auth.users trigger: NEW.id is the ownership source.
 -- auth.uid() can be null during signup; no user metadata is used for authorization.
 insert into public.profiles(id) values(new.id) on conflict(id) do nothing;
 return new;
end; $$;
revoke all on function private.create_profile() from public,anon,authenticated;
create trigger lissan_profile_after_signup after insert on auth.users for each row execute function private.create_profile();
-- Backfill if migrations are run after first signup.
insert into public.profiles(id) select id from auth.users on conflict(id) do nothing;

create function public.award_lesson(p_user_id uuid,p_lesson_id text,p_score integer,p_xp integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare inserted integer; previous_id text; earned integer:=0; v_language text; v_position integer; activity_day date := (now() at time zone 'Africa/Casablanca')::date;
begin
 if p_score not between 0 and 100 or p_xp not between 0 and 40 then raise exception 'Invalid score'; end if;
 -- Serialize per-user completions to prevent concurrent double awards/unlock races.
 perform 1 from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Profile missing'; end if;
 select u.language_id,u.position into v_language,v_position from public.lessons l join public.units u on u.id=l.unit_id where l.id=p_lesson_id;
 if v_language is null then raise exception 'Lesson missing'; end if;
 if v_position>1 then
 select l.id into previous_id from public.lessons l join public.units u on u.id=l.unit_id where u.language_id=v_language and u.position=v_position-1;
 if not exists(select 1 from public.user_progress where user_id=p_user_id and lesson_id=previous_id) then raise exception 'Lesson locked';end if;
 end if;
 if p_score>=75 then
 insert into public.user_progress(user_id,lesson_id,score,xp) values(p_user_id,p_lesson_id,p_score,p_xp) on conflict(user_id,lesson_id) do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then
 earned:=p_xp;
 update public.profiles set xp=xp+earned where id=p_user_id;
 insert into public.streaks(user_id,day,xp) values(p_user_id,activity_day,earned) on conflict(user_id,day) do update set xp=public.streaks.xp+excluded.xp;
 insert into public.user_achievements(user_id,achievement_id) values(p_user_id,'first-step') on conflict do nothing;
 if (select xp from public.profiles where id=p_user_id)>=100 then insert into public.user_achievements values(p_user_id,'100-xp',now()) on conflict do nothing;end if;
 if (select count(distinct u.language_id) from public.user_progress pr join public.lessons l on l.id=pr.lesson_id join public.units u on u.id=l.unit_id where pr.user_id=p_user_id)=3 then insert into public.user_achievements values(p_user_id,'three-languages',now()) on conflict do nothing;end if;
 if (select count(*) from public.streaks where user_id=p_user_id and day between activity_day-2 and activity_day)=3 then insert into public.user_achievements values(p_user_id,'three-days',now()) on conflict do nothing;end if;
 end if;
 end if;
 return jsonb_build_object('score',p_score,'xp',earned,'passed',p_score>=75);
end; $$;
revoke all on function public.award_lesson(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.award_lesson(uuid,text,integer,integer) to service_role;

create function public.review_card(p_user_id uuid,p_card_id text,p_known boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare n integer;due_at timestamptz;
begin
 perform 1 from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Profile missing';end if;
 if not exists(select 1 from public.flashcards where id=p_card_id) then raise exception 'Card missing';end if;
 select interval into n from public.flashcard_reviews where user_id=p_user_id and card_id=p_card_id;
 n:=case when p_known then least(coalesce(n,0)*2+1,60) else 0 end;
 due_at:=now()+greatest(n,1)*interval '1 day';
 insert into public.flashcard_reviews(user_id,card_id,interval,due) values(p_user_id,p_card_id,n,due_at) on conflict(user_id,card_id) do update set interval=excluded.interval,due=excluded.due,reviewed_at=now();
 return jsonb_build_object('interval',n,'due',due_at);
end; $$;
revoke all on function public.review_card(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.review_card(uuid,text,boolean) to service_role;

create view public.weekly_leaderboard with(security_invoker=true) as
 select p.id,p.name as display_name,sum(pr.xp)::integer as weekly_xp from public.profiles p join public.user_progress pr on pr.user_id=p.id where pr.completed_at>=date_trunc('week',now() at time zone 'Africa/Casablanca') at time zone 'Africa/Casablanca' group by p.id,p.name order by weekly_xp desc,p.id limit 10;
-- The server returns only display name and XP. Other users' profile IDs never leave the API.
revoke all on public.weekly_leaderboard from anon,authenticated;
grant select on public.weekly_leaderboard to service_role;
create index user_progress_completed on public.user_progress(completed_at);
create index games_user_date on public.game_scores(user_id,created_at);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('audio','audio',true,5242880,array['audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4']),
 ('user-recordings','user-recordings',false,5242880,array['audio/webm','audio/ogg','audio/mp4','audio/wav']) on conflict(id) do nothing;
create policy lesson_audio_public_read on storage.objects for select to public using(bucket_id='audio');
create policy recordings_read_own on storage.objects for select to authenticated using(bucket_id='user-recordings' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Uploads pass through the verified/rate-limited Edge function, not the browser Storage API.
create policy recordings_delete_own on storage.objects for delete to authenticated using(bucket_id='user-recordings' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
