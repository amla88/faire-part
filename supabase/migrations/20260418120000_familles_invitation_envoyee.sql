-- Suivi admin : invitation (faire-part) envoyée ou non par famille
alter table public.familles
  add column if not exists invitation_envoyee boolean not null default false;

comment on column public.familles.invitation_envoyee is 'Indique si le faire-part / lien d''invitation a été envoyé à la famille (usage admin).';
