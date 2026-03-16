drop policy "Avatars: modification par famille ou admin" on "public"."avatars";

drop policy "Musiques: modification par admin" on "public"."musiques";

drop policy "Musiques: suppression par admin" on "public"."musiques";

drop policy "Avatars: lecture par famille" on "public"."avatars";

drop policy "Musiques: insertion par famille" on "public"."musiques";

drop policy "Musiques: lecture par famille ou admin" on "public"."musiques";

alter table "public"."familles" drop constraint "users_auth_uuid_fkey";

drop view if exists "public"."stats_rapides";

drop index if exists "public"."idx_familles_auth_uuid_active";

alter table "public"."familles" drop column "auth_uuid";

alter table "public"."familles" drop column "created_by";

create or replace view "public"."stats_rapides" as  SELECT ( SELECT count(*) AS count
           FROM public.familles) AS nb_familles,
    ( SELECT count(*) AS count
           FROM public.personnes) AS nb_personnes,
    ( SELECT count(*) AS count
           FROM public.avatars) AS nb_avatars_crees,
    ( SELECT count(*) AS count
           FROM public.musiques) AS nb_musiques_proposees,
    ( SELECT count(*) AS count
           FROM public.personnes
          WHERE (personnes.present_reception = true)) AS confirmations_reception,
    ( SELECT count(*) AS count
           FROM public.personnes
          WHERE (personnes.present_repas = true)) AS confirmations_repas,
    ( SELECT count(*) AS count
           FROM public.personnes
          WHERE (personnes.present_soiree = true)) AS confirmations_soiree;



  create policy "Avatars: modification par famille"
  on "public"."avatars"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM (public.personnes p
     JOIN public.familles f ON ((p.famille_id = f.id)))
  WHERE (p.id = avatars.personne_id))));



  create policy "Admin full access"
  on "public"."musiques"
  as permissive
  for all
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Avatars: lecture par famille"
  on "public"."avatars"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.personnes p
     JOIN public.familles f ON ((p.famille_id = f.id)))
  WHERE (p.id = avatars.personne_id))));



  create policy "Musiques: insertion par famille"
  on "public"."musiques"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM (public.personnes p
     JOIN public.familles f ON ((p.famille_id = f.id)))
  WHERE (p.id = musiques.personne_id))));



  create policy "Musiques: lecture par famille ou admin"
  on "public"."musiques"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.personnes p
     JOIN public.familles f ON ((p.famille_id = f.id)))
  WHERE (p.id = musiques.personne_id))));



