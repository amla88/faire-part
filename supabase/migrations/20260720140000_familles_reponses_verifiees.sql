-- Suivi admin : réponses de présence vérifiées ou non par famille
alter table public.familles
  add column if not exists reponses_verifiees boolean not null default false;

comment on column public.familles.reponses_verifiees is 'Indique si les réponses RSVP de la famille ont été vérifiées par l''admin (usage suivi présences).';
