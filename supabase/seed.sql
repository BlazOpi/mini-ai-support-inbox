-- Demo tickets: made-up customers, reserved example.com addresses and made-up order numbers.
-- Six are waiting for an agent, one failed in the AI step and two were already answered.
--
-- Safe to run more than once: the rows have fixed ids, so the ones that exist are skipped.
-- To remove the demo data again (replies and history are deleted with their messages):
--   delete from messages where id::text like '10000000-%';

insert into messages
  (id, thread_id, customer_name, customer_email, body, category, category_confidence, category_source, status, ai_error, created_at, updated_at)
values
  -- Open: AI drafted a reply, an agent still has to check and approve it.
  ('10000000-0000-4000-8000-000000000001', null, 'Ana Novak', 'ana.novak@example.com',
   'Brezžični zvočnik iz naročila SI-48213 je prispel poškodovan, embalaža je bila raztrgana. Prosim za zamenjavo ali vračilo denarja.',
   'complaint', 0.94, 'ai', 'draft_ready', null, now() - interval '25 minutes', now() - interval '25 minutes'),
  ('10000000-0000-4000-8000-000000000002', null, 'Marko Kovač', 'marko.kovac@example.com',
   'Kdaj lahko pričakujem dostavo naročila SI-48190? Na sledenju se stanje že tri dni ne spreminja.',
   'question', 0.97, 'ai', 'draft_ready', null, now() - interval '1 hour', now() - interval '1 hour'),
  ('10000000-0000-4000-8000-000000000003', null, 'Nina Horvat', 'nina.horvat@example.com',
   'Naročilo SI-47956 zamuja že deset dni, na sporočila pa ne dobim odgovora. To je nesprejemljivo.',
   'complaint', 0.91, 'ai', 'draft_ready', null, now() - interval '2 hours', now() - interval '2 hours'),

  -- Open: an agent already edited the draft, so the history shows the text before and after.
  ('10000000-0000-4000-8000-000000000004', null, 'Luka Krajnc', 'luka.krajnc@example.com',
   'Ali garancija za kavni aparat velja tudi za vgrajeni mlinček?',
   'question', 0.88, 'ai', 'draft_ready', null, now() - interval '3 hours', now() - interval '150 minutes'),

  -- Open: an agent corrected the AI's category from "other" to "question".
  ('10000000-0000-4000-8000-000000000005', null, 'Maja Zupančič', 'maja.zupancic@example.com',
   'Zanima me, ali nudite količinske popuste za podjetja.',
   'question', null, 'human', 'draft_ready', null, now() - interval '5 hours', now() - interval '4 hours'),

  -- Open: the AI step failed. The message is safe and "Ponovi AI obdelavo" retries it.
  ('10000000-0000-4000-8000-000000000006', null, 'Tine Potočnik', 'tine.potocnik@example.com',
   'Prosim, odjavite moj e-naslov od vaših novic.',
   null, null, null, 'failed', 'AI storitev je trenutno preobremenjena. Poskusi znova čez minuto.',
   now() - interval '40 minutes', now() - interval '40 minutes'),

  -- Answered: the reply was approved.
  ('10000000-0000-4000-8000-000000000007', null, 'Eva Kralj', 'eva.kralj@example.com',
   'Dostava je bila hitra, izdelek pa odličen. Hvala!',
   'praise', 0.99, 'ai', 'approved', null, now() - interval '1 day', now() - interval '23 hours'),

  -- A conversation: the first question was answered, and the customer's follow-up is open.
  ('10000000-0000-4000-8000-000000000008', null, 'Jan Vidmar', 'jan.vidmar@example.com',
   'Kako lahko vrnem mešalnik, ki mi ne ustreza?',
   'question', 0.95, 'ai', 'approved', null, now() - interval '2 days', now() - interval '47 hours'),
  ('10000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000008', 'Jan Vidmar', 'jan.vidmar@example.com',
   'Hvala. Ali moram priložiti tudi račun?',
   'question', 0.93, 'ai', 'draft_ready', null, now() - interval '45 minutes', now() - interval '45 minutes')
on conflict do nothing;

insert into replies
  (id, message_id, ai_draft, body, model, prompt_version, approved_at, created_at, updated_at)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   E'Pozdravljeni, Ana Novak,\n\niskreno se opravičujemo za poškodovan paket. Prosimo, pošljite nam fotografijo izdelka in embalaže, da vam takoj uredimo zamenjavo ali vračilo denarja.\n\nLep pozdrav,\nEkipa za podporo strankam',
   E'Pozdravljeni, Ana Novak,\n\niskreno se opravičujemo za poškodovan paket. Prosimo, pošljite nam fotografijo izdelka in embalaže, da vam takoj uredimo zamenjavo ali vračilo denarja.\n\nLep pozdrav,\nEkipa za podporo strankam',
   'demo/seed', 'seed', null, now() - interval '25 minutes', now() - interval '25 minutes'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002',
   E'Pozdravljeni, Marko Kovač,\n\nhvala za sporočilo. Stanje naročila SI-48190 bomo preverili pri dostavni službi in vam odgovorili v enem delovnem dnevu.\n\nLep pozdrav,\nEkipa za podporo strankam',
   E'Pozdravljeni, Marko Kovač,\n\nhvala za sporočilo. Stanje naročila SI-48190 bomo preverili pri dostavni službi in vam odgovorili v enem delovnem dnevu.\n\nLep pozdrav,\nEkipa za podporo strankam',
   'demo/seed', 'seed', null, now() - interval '1 hour', now() - interval '1 hour'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003',
   E'Pozdravljeni, Nina Horvat,\n\nrazumemo vaše nezadovoljstvo in se opravičujemo za zamudo. Naročilo SI-47956 smo posredovali odgovorni osebi, ki vas bo še danes obvestila o naslednjih korakih.\n\nLep pozdrav,\nEkipa za podporo strankam',
   E'Pozdravljeni, Nina Horvat,\n\nrazumemo vaše nezadovoljstvo in se opravičujemo za zamudo. Naročilo SI-47956 smo posredovali odgovorni osebi, ki vas bo še danes obvestila o naslednjih korakih.\n\nLep pozdrav,\nEkipa za podporo strankam',
   'demo/seed', 'seed', null, now() - interval '2 hours', now() - interval '2 hours'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004',
   E'Pozdravljeni, Luka Krajnc,\n\ngarancija velja za celoten izdelek. Podrobnosti najdete v garancijskem listu.\n\nLep pozdrav,\nEkipa za podporo strankam',
   E'Pozdravljeni, Luka Krajnc,\n\nda, 24-mesečna garancija velja tudi za vgrajeni mlinček. Če je z njim kaj narobe, nam pošljite številko naročila in uredili bomo popravilo.\n\nLep pozdrav,\nEkipa za podporo strankam',
   'demo/seed', 'seed', null, now() - interval '3 hours', now() - interval '150 minutes'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005',
   E'Pozdravljeni, Maja Zupančič,\n\nza podjetja pripravimo ponudbo glede na količino. Sporočite nam, katere izdelke in koliko kosov potrebujete.\n\nLep pozdrav,\nEkipa za podporo strankam',
   E'Pozdravljeni, Maja Zupančič,\n\nza podjetja pripravimo ponudbo glede na količino. Sporočite nam, katere izdelke in koliko kosov potrebujete.\n\nLep pozdrav,\nEkipa za podporo strankam',
   'demo/seed', 'seed', null, now() - interval '5 hours', now() - interval '5 hours'),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000007',
   E'Pozdravljeni, Eva Kralj,\n\nhvala za prijazne besede, veseli smo, da ste zadovoljni.\n\nLep pozdrav,\nEkipa za podporo strankam',
   E'Pozdravljeni, Eva Kralj,\n\nhvala za prijazne besede, veseli smo, da ste zadovoljni.\n\nLep pozdrav,\nEkipa za podporo strankam',
   'demo/seed', 'seed', now() - interval '23 hours', now() - interval '1 day', now() - interval '23 hours'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000008',
   E'Pozdravljeni, Jan Vidmar,\n\nizdelek lahko vrnete v 14 dneh od prejema. Navodila za vračilo vam pošljemo po e-pošti.\n\nLep pozdrav,\nEkipa za podporo strankam',
   E'Pozdravljeni, Jan Vidmar,\n\nizdelek lahko vrnete v 14 dneh od prejema. Navodila za vračilo vam pošljemo po e-pošti.\n\nLep pozdrav,\nEkipa za podporo strankam',
   'demo/seed', 'seed', now() - interval '47 hours', now() - interval '2 days', now() - interval '47 hours'),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000009',
   E'Pozdravljeni, Jan Vidmar,\n\nda, prosimo, priložite račun ali potrdilo o nakupu, da bo vračilo hitrejše.\n\nLep pozdrav,\nEkipa za podporo strankam',
   E'Pozdravljeni, Jan Vidmar,\n\nda, prosimo, priložite račun ali potrdilo o nakupu, da bo vračilo hitrejše.\n\nLep pozdrav,\nEkipa za podporo strankam',
   'demo/seed', 'seed', null, now() - interval '45 minutes', now() - interval '45 minutes')
on conflict do nothing;

-- The history below is built from the rows above, so the same text doesn't have to be written
-- twice. Each id is a hash of the message and the kind of change, which keeps it the same between
-- runs, so running this file again adds nothing. Only demo messages are ever selected.

-- The customer wrote in.
insert into message_events (id, message_id, type, actor, new_value, created_at)
select md5(m.id::text || 'received')::uuid, m.id,
       (case when m.thread_id is null then 'message_received' else 'customer_replied' end)::message_event_type,
       'customer'::message_event_actor, m.body, m.created_at
from messages m
where m.id::text like '10000000-%'
on conflict do nothing;

-- The AI drafted a reply.
insert into message_events (id, message_id, type, actor, new_value, details, created_at)
select md5(r.message_id::text || 'draft')::uuid, r.message_id,
       'ai_draft_created'::message_event_type, 'ai'::message_event_actor, r.ai_draft,
       jsonb_build_object('model', r.model, 'promptVersion', r.prompt_version), r.created_at
from replies r
where r.message_id::text like '10000000-%'
on conflict do nothing;

-- The AI step failed.
insert into message_events (id, message_id, type, actor, details, created_at)
select md5(m.id::text || 'failed')::uuid, m.id,
       'ai_failed'::message_event_type, 'ai'::message_event_actor,
       jsonb_build_object('error', 'AI storitev je trenutno preobremenjena. Poskusi znova čez minuto.'), m.updated_at
from messages m
where m.id = '10000000-0000-4000-8000-000000000006'
on conflict do nothing;

-- An agent edited a draft: the text before and after.
insert into message_events (id, message_id, type, actor, old_value, new_value, created_at)
select md5(r.message_id::text || 'edited')::uuid, r.message_id,
       'reply_edited'::message_event_type, 'agent'::message_event_actor, r.ai_draft, r.body, r.updated_at
from replies r
where r.message_id = '10000000-0000-4000-8000-000000000004'
on conflict do nothing;

-- An agent corrected the AI's category.
insert into message_events (id, message_id, type, actor, old_value, new_value, created_at)
select md5(m.id::text || 'category')::uuid, m.id,
       'category_changed'::message_event_type, 'agent'::message_event_actor, 'other', m.category::text, m.updated_at
from messages m
where m.id = '10000000-0000-4000-8000-000000000005'
on conflict do nothing;

-- An agent approved a reply: the exact text that went out.
insert into message_events (id, message_id, type, actor, new_value, created_at)
select md5(r.message_id::text || 'approved')::uuid, r.message_id,
       'reply_approved'::message_event_type, 'agent'::message_event_actor, r.body, r.approved_at
from replies r
where r.message_id in ('10000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000008')
on conflict do nothing;
