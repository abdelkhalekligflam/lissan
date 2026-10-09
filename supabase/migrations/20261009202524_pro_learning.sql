begin;
-- Subscription entitlements can only be written by trusted administration/payment code.
create table public.subscriptions (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 plan text not null default 'free' check(plan in ('free','pro')),
 status text not null default 'inactive' check(status in ('inactive','active','canceled')),
 expires_at timestamptz,
 source text not null default 'manual' check(source in ('manual','payment')),
 created_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from public,anon,authenticated;
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
create policy subscriptions_read_own on public.subscriptions for select to authenticated using(user_id=(select auth.uid()));
create function public.has_pro() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.subscriptions where user_id=(select auth.uid()) and plan='pro' and status='active' and (expires_at is null or expires_at>now()));
$$;
revoke all on function public.has_pro() from public,anon;
grant execute on function public.has_pro() to authenticated,service_role;
drop policy units_read on public.units;
create policy units_read on public.units for select to authenticated using(position<=3 or (select public.has_pro()));
drop policy lessons_read on public.lessons;
create policy lessons_read on public.lessons for select to authenticated using(exists(select 1 from public.units u where u.id=unit_id));
drop policy exercises_read on public.exercises;
create policy exercises_read on public.exercises for select to authenticated using(exists(select 1 from public.lessons l where l.id=lesson_id));
drop policy flashcards_read on public.flashcards;
create policy flashcards_read on public.flashcards for select to authenticated using(exists(select 1 from public.lessons l where l.id=lesson_id));
create or replace function public.award_lesson(p_user_id uuid,p_lesson_id text,p_score integer,p_xp integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare inserted integer; previous_id text; earned integer:=0; v_language text; v_position integer; activity_day date := (now() at time zone 'Africa/Casablanca')::date;
begin
 if p_score not between 0 and 100 or p_xp not between 0 and 40 then raise exception 'Invalid score'; end if;
 -- Serialize per-user completions to prevent concurrent double awards/unlock races.
 perform 1 from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Profile missing'; end if;
 select u.language_id,u.position into v_language,v_position from public.lessons l join public.units u on u.id=l.unit_id where l.id=p_lesson_id;
 if v_language is null then raise exception 'Lesson missing'; end if;
 if v_position>3 and not exists(select 1 from public.subscriptions where user_id=p_user_id and plan='pro' and status='active' and (expires_at is null or expires_at>now())) then raise exception 'Pro required';end if;
 if v_position>1 and v_position<=3 then
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

create or replace function public.review_card(p_user_id uuid,p_card_id text,p_known boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare n integer;due_at timestamptz;
begin
 perform 1 from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Profile missing';end if;
 if not exists(select 1 from public.flashcards where id=p_card_id) then raise exception 'Card missing';end if;
 if exists(select 1 from public.flashcards f join public.lessons l on l.id=f.lesson_id join public.units u on u.id=l.unit_id where f.id=p_card_id and u.position>3) and not exists(select 1 from public.subscriptions where user_id=p_user_id and plan='pro' and status='active' and (expires_at is null or expires_at>now())) then raise exception 'Pro required';end if;
 select interval into n from public.flashcard_reviews where user_id=p_user_id and card_id=p_card_id;
 n:=case when p_known then least(coalesce(n,0)*2+1,60) else 0 end;
 due_at:=now()+greatest(n,1)*interval '1 day';
 insert into public.flashcard_reviews(user_id,card_id,interval,due) values(p_user_id,p_card_id,n,due_at) on conflict(user_id,card_id) do update set interval=excluded.interval,due=excluded.due,reviewed_at=now();
 return jsonb_build_object('interval',n,'due',due_at);
end; $$;
revoke all on function public.review_card(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.review_card(uuid,text,boolean) to service_role;

-- Pro curriculum seed
insert into public.languages(id,name) values('es','الإسبانية'),('en','الإنجليزية'),('fr','الفرنسية') on conflict(id) do nothing;
insert into public.units(id,language_id,title,position) values('es-unit-4','es','مقابلة العمل',4);
insert into public.lessons(id,unit_id,title,words,position) values('es-4','es-unit-4','مقابلة العمل','[{"word":"Tengo experiencia","ar":"لدي خبرة","en":"I have experience","fr":"J’ai de l’expérience","example":"Tengo experiencia en ventas.","emoji":"💼"},{"word":"Busco trabajo","ar":"أبحث عن عمل","en":"I am looking for work","fr":"Je cherche du travail","example":"Busco trabajo en una empresa internacional.","emoji":"💼"},{"word":"Mis habilidades","ar":"مهاراتي","en":"My skills","fr":"Mes compétences","example":"Mis habilidades incluyen la comunicación.","emoji":"💼"},{"word":"Estoy disponible","ar":"أنا متاح","en":"I am available","fr":"Je suis disponible","example":"Estoy disponible para una entrevista.","emoji":"💼"}]'::jsonb,1);
insert into public.flashcards(id,lesson_id,word,translation,example) values('es-3-0','es-4','Tengo experiencia','لدي خبرة','Tengo experiencia en ventas.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('es-3-1','es-4','Busco trabajo','أبحث عن عمل','Busco trabajo en una empresa internacional.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('es-3-2','es-4','Mis habilidades','مهاراتي','Mis habilidades incluyen la comunicación.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('es-3-3','es-4','Estoy disponible','أنا متاح','Estoy disponible para una entrevista.');
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('es-4-q0','es-4','choice','لدي خبرة','["Tengo experiencia","Busco trabajo","Mis habilidades","Estoy disponible"]'::jsonb,1);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('es-4-q1','es-4','fill','أبحث عن عمل','["Tengo experiencia","Busco trabajo","Mis habilidades","Estoy disponible"]'::jsonb,2);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('es-4-q2','es-4','choice','مهاراتي','["Tengo experiencia","Busco trabajo","Mis habilidades","Estoy disponible"]'::jsonb,3);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('es-4-q3','es-4','build','أنا متاح','["Estoy","disponible","para","una","entrevista."]'::jsonb,4);
insert into public.units(id,language_id,title,position) values('es-unit-5','es','التواصل في العمل',5);
insert into public.lessons(id,unit_id,title,words,position) values('es-5','es-unit-5','التواصل في العمل','[{"word":"Una reunión","ar":"اجتماع","en":"A meeting","fr":"Une réunion","example":"Tenemos una reunión a las diez.","emoji":"🤝"},{"word":"El plazo","ar":"الموعد النهائي","en":"The deadline","fr":"La date limite","example":"El plazo es el viernes.","emoji":"🤝"},{"word":"¿Puedes ayudarme?","ar":"هل يمكنك مساعدتي؟","en":"Can you help me?","fr":"Peux-tu m’aider ?","example":"¿Puedes ayudarme con este informe?","emoji":"🤝"},{"word":"Te envío el documento","ar":"سأرسل لك الوثيقة","en":"I am sending you the document","fr":"Je t’envoie le document","example":"Te envío el documento por correo.","emoji":"🤝"}]'::jsonb,1);
insert into public.flashcards(id,lesson_id,word,translation,example) values('es-4-0','es-5','Una reunión','اجتماع','Tenemos una reunión a las diez.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('es-4-1','es-5','El plazo','الموعد النهائي','El plazo es el viernes.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('es-4-2','es-5','¿Puedes ayudarme?','هل يمكنك مساعدتي؟','¿Puedes ayudarme con este informe?');
insert into public.flashcards(id,lesson_id,word,translation,example) values('es-4-3','es-5','Te envío el documento','سأرسل لك الوثيقة','Te envío el documento por correo.');
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('es-5-q0','es-5','choice','اجتماع','["Una reunión","El plazo","¿Puedes ayudarme?","Te envío el documento"]'::jsonb,1);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('es-5-q1','es-5','fill','الموعد النهائي','["Una reunión","El plazo","¿Puedes ayudarme?","Te envío el documento"]'::jsonb,2);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('es-5-q2','es-5','choice','هل يمكنك مساعدتي؟','["Una reunión","El plazo","¿Puedes ayudarme?","Te envío el documento"]'::jsonb,3);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('es-5-q3','es-5','build','سأرسل لك الوثيقة','["Te","envío","el","documento","por","correo."]'::jsonb,4);
insert into public.units(id,language_id,title,position) values('es-unit-6','es','الفندق والمطار',6);
insert into public.lessons(id,unit_id,title,words,position) values('es-6','es-unit-6','الفندق والمطار','[{"word":"Tengo una reserva","ar":"لدي حجز","en":"I have a reservation","fr":"J’ai une réservation","example":"Tengo una reserva para dos noches.","emoji":"✈️"},{"word":"Mi equipaje","ar":"أمتعتي","en":"My luggage","fr":"Mes bagages","example":"Mi equipaje no ha llegado.","emoji":"✈️"},{"word":"La puerta de embarque","ar":"بوابة الصعود","en":"The boarding gate","fr":"La porte d’embarquement","example":"¿Dónde está la puerta de embarque?","emoji":"✈️"},{"word":"¿A qué hora sale el vuelo?","ar":"في أي ساعة تقلع الطائرة؟","en":"What time does the flight depart?","fr":"À quelle heure part le vol ?","example":"¿A qué hora sale el vuelo a París?","emoji":"✈️"}]'::jsonb,1);
insert into public.flashcards(id,lesson_id,word,translation,example) values('es-5-0','es-6','Tengo una reserva','لدي حجز','Tengo una reserva para dos noches.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('es-5-1','es-6','Mi equipaje','أمتعتي','Mi equipaje no ha llegado.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('es-5-2','es-6','La puerta de embarque','بوابة الصعود','¿Dónde está la puerta de embarque?');
insert into public.flashcards(id,lesson_id,word,translation,example) values('es-5-3','es-6','¿A qué hora sale el vuelo?','في أي ساعة تقلع الطائرة؟','¿A qué hora sale el vuelo a París?');
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('es-6-q0','es-6','choice','لدي حجز','["Tengo una reserva","Mi equipaje","La puerta de embarque","¿A qué hora sale el vuelo?"]'::jsonb,1);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('es-6-q1','es-6','fill','أمتعتي','["Tengo una reserva","Mi equipaje","La puerta de embarque","¿A qué hora sale el vuelo?"]'::jsonb,2);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('es-6-q2','es-6','choice','بوابة الصعود','["Tengo una reserva","Mi equipaje","La puerta de embarque","¿A qué hora sale el vuelo?"]'::jsonb,3);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('es-6-q3','es-6','build','في أي ساعة تقلع الطائرة؟','["¿A","qué","hora","sale","el","vuelo","a","París?"]'::jsonb,4);
insert into public.units(id,language_id,title,position) values('en-unit-4','en','مقابلة العمل',4);
insert into public.lessons(id,unit_id,title,words,position) values('en-4','en-unit-4','مقابلة العمل','[{"word":"I have experience","ar":"لدي خبرة","en":"I have experience","fr":"J’ai de l’expérience","example":"I have experience in customer service.","emoji":"💼"},{"word":"I am looking for work","ar":"أبحث عن عمل","en":"I am looking for work","fr":"Je cherche du travail","example":"I am looking for work in technology.","emoji":"💼"},{"word":"My skills","ar":"مهاراتي","en":"My skills","fr":"Mes compétences","example":"My skills include problem solving.","emoji":"💼"},{"word":"I am available","ar":"أنا متاح","en":"I am available","fr":"Je suis disponible","example":"I am available for an interview.","emoji":"💼"}]'::jsonb,1);
insert into public.flashcards(id,lesson_id,word,translation,example) values('en-3-0','en-4','I have experience','لدي خبرة','I have experience in customer service.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('en-3-1','en-4','I am looking for work','أبحث عن عمل','I am looking for work in technology.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('en-3-2','en-4','My skills','مهاراتي','My skills include problem solving.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('en-3-3','en-4','I am available','أنا متاح','I am available for an interview.');
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('en-4-q0','en-4','choice','لدي خبرة','["I have experience","I am looking for work","My skills","I am available"]'::jsonb,1);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('en-4-q1','en-4','fill','أبحث عن عمل','["I have experience","I am looking for work","My skills","I am available"]'::jsonb,2);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('en-4-q2','en-4','choice','مهاراتي','["I have experience","I am looking for work","My skills","I am available"]'::jsonb,3);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('en-4-q3','en-4','build','أنا متاح','["I","am","available","for","an","interview."]'::jsonb,4);
insert into public.units(id,language_id,title,position) values('en-unit-5','en','التواصل في العمل',5);
insert into public.lessons(id,unit_id,title,words,position) values('en-5','en-unit-5','التواصل في العمل','[{"word":"A meeting","ar":"اجتماع","en":"A meeting","fr":"Une réunion","example":"We have a meeting at ten.","emoji":"🤝"},{"word":"The deadline","ar":"الموعد النهائي","en":"The deadline","fr":"La date limite","example":"The deadline is Friday.","emoji":"🤝"},{"word":"Can you help me?","ar":"هل يمكنك مساعدتي؟","en":"Can you help me?","fr":"Peux-tu m’aider ?","example":"Can you help me with this report?","emoji":"🤝"},{"word":"I will send the document","ar":"سأرسل الوثيقة","en":"I will send the document","fr":"J’enverrai le document","example":"I will send the document by email.","emoji":"🤝"}]'::jsonb,1);
insert into public.flashcards(id,lesson_id,word,translation,example) values('en-4-0','en-5','A meeting','اجتماع','We have a meeting at ten.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('en-4-1','en-5','The deadline','الموعد النهائي','The deadline is Friday.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('en-4-2','en-5','Can you help me?','هل يمكنك مساعدتي؟','Can you help me with this report?');
insert into public.flashcards(id,lesson_id,word,translation,example) values('en-4-3','en-5','I will send the document','سأرسل الوثيقة','I will send the document by email.');
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('en-5-q0','en-5','choice','اجتماع','["A meeting","The deadline","Can you help me?","I will send the document"]'::jsonb,1);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('en-5-q1','en-5','fill','الموعد النهائي','["A meeting","The deadline","Can you help me?","I will send the document"]'::jsonb,2);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('en-5-q2','en-5','choice','هل يمكنك مساعدتي؟','["A meeting","The deadline","Can you help me?","I will send the document"]'::jsonb,3);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('en-5-q3','en-5','build','سأرسل الوثيقة','["I","will","send","the","document","by","email."]'::jsonb,4);
insert into public.units(id,language_id,title,position) values('en-unit-6','en','الفندق والمطار',6);
insert into public.lessons(id,unit_id,title,words,position) values('en-6','en-unit-6','الفندق والمطار','[{"word":"I have a reservation","ar":"لدي حجز","en":"I have a reservation","fr":"J’ai une réservation","example":"I have a reservation for two nights.","emoji":"✈️"},{"word":"My luggage","ar":"أمتعتي","en":"My luggage","fr":"Mes bagages","example":"My luggage has not arrived.","emoji":"✈️"},{"word":"The boarding gate","ar":"بوابة الصعود","en":"The boarding gate","fr":"La porte d’embarquement","example":"Where is the boarding gate?","emoji":"✈️"},{"word":"What time does the flight depart?","ar":"في أي ساعة تقلع الطائرة؟","en":"What time does the flight depart?","fr":"À quelle heure part le vol ?","example":"What time does the flight depart for Paris?","emoji":"✈️"}]'::jsonb,1);
insert into public.flashcards(id,lesson_id,word,translation,example) values('en-5-0','en-6','I have a reservation','لدي حجز','I have a reservation for two nights.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('en-5-1','en-6','My luggage','أمتعتي','My luggage has not arrived.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('en-5-2','en-6','The boarding gate','بوابة الصعود','Where is the boarding gate?');
insert into public.flashcards(id,lesson_id,word,translation,example) values('en-5-3','en-6','What time does the flight depart?','في أي ساعة تقلع الطائرة؟','What time does the flight depart for Paris?');
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('en-6-q0','en-6','choice','لدي حجز','["I have a reservation","My luggage","The boarding gate","What time does the flight depart?"]'::jsonb,1);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('en-6-q1','en-6','fill','أمتعتي','["I have a reservation","My luggage","The boarding gate","What time does the flight depart?"]'::jsonb,2);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('en-6-q2','en-6','choice','بوابة الصعود','["I have a reservation","My luggage","The boarding gate","What time does the flight depart?"]'::jsonb,3);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('en-6-q3','en-6','build','في أي ساعة تقلع الطائرة؟','["What","time","does","the","flight","depart","for","Paris?"]'::jsonb,4);
insert into public.units(id,language_id,title,position) values('fr-unit-4','fr','مقابلة العمل',4);
insert into public.lessons(id,unit_id,title,words,position) values('fr-4','fr-unit-4','مقابلة العمل','[{"word":"J’ai de l’expérience","ar":"لدي خبرة","en":"I have experience","fr":"J’ai de l’expérience","example":"J’ai de l’expérience dans la vente.","emoji":"💼"},{"word":"Je cherche du travail","ar":"أبحث عن عمل","en":"I am looking for work","fr":"Je cherche du travail","example":"Je cherche du travail dans une entreprise internationale.","emoji":"💼"},{"word":"Mes compétences","ar":"مهاراتي","en":"My skills","fr":"Mes compétences","example":"Mes compétences incluent la communication.","emoji":"💼"},{"word":"Je suis disponible","ar":"أنا متاح","en":"I am available","fr":"Je suis disponible","example":"Je suis disponible pour un entretien.","emoji":"💼"}]'::jsonb,1);
insert into public.flashcards(id,lesson_id,word,translation,example) values('fr-3-0','fr-4','J’ai de l’expérience','لدي خبرة','J’ai de l’expérience dans la vente.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('fr-3-1','fr-4','Je cherche du travail','أبحث عن عمل','Je cherche du travail dans une entreprise internationale.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('fr-3-2','fr-4','Mes compétences','مهاراتي','Mes compétences incluent la communication.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('fr-3-3','fr-4','Je suis disponible','أنا متاح','Je suis disponible pour un entretien.');
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('fr-4-q0','fr-4','choice','لدي خبرة','["J’ai de l’expérience","Je cherche du travail","Mes compétences","Je suis disponible"]'::jsonb,1);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('fr-4-q1','fr-4','fill','أبحث عن عمل','["J’ai de l’expérience","Je cherche du travail","Mes compétences","Je suis disponible"]'::jsonb,2);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('fr-4-q2','fr-4','choice','مهاراتي','["J’ai de l’expérience","Je cherche du travail","Mes compétences","Je suis disponible"]'::jsonb,3);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('fr-4-q3','fr-4','build','أنا متاح','["Je","suis","disponible","pour","un","entretien."]'::jsonb,4);
insert into public.units(id,language_id,title,position) values('fr-unit-5','fr','التواصل في العمل',5);
insert into public.lessons(id,unit_id,title,words,position) values('fr-5','fr-unit-5','التواصل في العمل','[{"word":"Une réunion","ar":"اجتماع","en":"A meeting","fr":"Une réunion","example":"Nous avons une réunion à dix heures.","emoji":"🤝"},{"word":"La date limite","ar":"الموعد النهائي","en":"The deadline","fr":"La date limite","example":"La date limite est vendredi.","emoji":"🤝"},{"word":"Peux-tu m’aider ?","ar":"هل يمكنك مساعدتي؟","en":"Can you help me?","fr":"Peux-tu m’aider ?","example":"Peux-tu m’aider avec ce rapport ?","emoji":"🤝"},{"word":"Je t’envoie le document","ar":"سأرسل لك الوثيقة","en":"I am sending you the document","fr":"Je t’envoie le document","example":"Je t’envoie le document par courriel.","emoji":"🤝"}]'::jsonb,1);
insert into public.flashcards(id,lesson_id,word,translation,example) values('fr-4-0','fr-5','Une réunion','اجتماع','Nous avons une réunion à dix heures.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('fr-4-1','fr-5','La date limite','الموعد النهائي','La date limite est vendredi.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('fr-4-2','fr-5','Peux-tu m’aider ?','هل يمكنك مساعدتي؟','Peux-tu m’aider avec ce rapport ?');
insert into public.flashcards(id,lesson_id,word,translation,example) values('fr-4-3','fr-5','Je t’envoie le document','سأرسل لك الوثيقة','Je t’envoie le document par courriel.');
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('fr-5-q0','fr-5','choice','اجتماع','["Une réunion","La date limite","Peux-tu m’aider ?","Je t’envoie le document"]'::jsonb,1);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('fr-5-q1','fr-5','fill','الموعد النهائي','["Une réunion","La date limite","Peux-tu m’aider ?","Je t’envoie le document"]'::jsonb,2);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('fr-5-q2','fr-5','choice','هل يمكنك مساعدتي؟','["Une réunion","La date limite","Peux-tu m’aider ?","Je t’envoie le document"]'::jsonb,3);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('fr-5-q3','fr-5','build','سأرسل لك الوثيقة','["Je","t’envoie","le","document","par","courriel."]'::jsonb,4);
insert into public.units(id,language_id,title,position) values('fr-unit-6','fr','الفندق والمطار',6);
insert into public.lessons(id,unit_id,title,words,position) values('fr-6','fr-unit-6','الفندق والمطار','[{"word":"J’ai une réservation","ar":"لدي حجز","en":"I have a reservation","fr":"J’ai une réservation","example":"J’ai une réservation pour deux nuits.","emoji":"✈️"},{"word":"Mes bagages","ar":"أمتعتي","en":"My luggage","fr":"Mes bagages","example":"Mes bagages ne sont pas arrivés.","emoji":"✈️"},{"word":"La porte d’embarquement","ar":"بوابة الصعود","en":"The boarding gate","fr":"La porte d’embarquement","example":"Où est la porte d’embarquement ?","emoji":"✈️"},{"word":"À quelle heure part le vol ?","ar":"في أي ساعة تقلع الطائرة؟","en":"What time does the flight depart?","fr":"À quelle heure part le vol ?","example":"À quelle heure part le vol pour Paris ?","emoji":"✈️"}]'::jsonb,1);
insert into public.flashcards(id,lesson_id,word,translation,example) values('fr-5-0','fr-6','J’ai une réservation','لدي حجز','J’ai une réservation pour deux nuits.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('fr-5-1','fr-6','Mes bagages','أمتعتي','Mes bagages ne sont pas arrivés.');
insert into public.flashcards(id,lesson_id,word,translation,example) values('fr-5-2','fr-6','La porte d’embarquement','بوابة الصعود','Où est la porte d’embarquement ?');
insert into public.flashcards(id,lesson_id,word,translation,example) values('fr-5-3','fr-6','À quelle heure part le vol ?','في أي ساعة تقلع الطائرة؟','À quelle heure part le vol pour Paris ?');
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('fr-6-q0','fr-6','choice','لدي حجز','["J’ai une réservation","Mes bagages","La porte d’embarquement","À quelle heure part le vol ?"]'::jsonb,1);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('fr-6-q1','fr-6','fill','أمتعتي','["J’ai une réservation","Mes bagages","La porte d’embarquement","À quelle heure part le vol ?"]'::jsonb,2);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('fr-6-q2','fr-6','choice','بوابة الصعود','["J’ai une réservation","Mes bagages","La porte d’embarquement","À quelle heure part le vol ?"]'::jsonb,3);
insert into public.exercises(id,lesson_id,type,prompt,options,position) values('fr-6-q3','fr-6','build','في أي ساعة تقلع الطائرة؟','["À","quelle","heure","part","le","vol","pour","Paris","?"]'::jsonb,4);
commit;
