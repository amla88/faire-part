drop policy "Avatars: lecture par famille ou admin" on "public"."avatars";

drop policy "Allow select for same famille" on "public"."personnes";

drop policy "audit_log_admin_only" on "public"."audit_log";

drop policy "Avatars: modification par famille ou admin" on "public"."avatars";

drop policy "Musiques: lecture par famille ou admin" on "public"."musiques";

drop policy "Musiques: suppression par admin" on "public"."musiques";

drop function if exists "public"."is_admin"();


  create policy "Avatars: lecture par famille"
  on "public"."avatars"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.personnes p
     JOIN public.familles f ON ((p.famille_id = f.id)))
  WHERE ((p.id = avatars.personne_id) AND (f.auth_uuid = ( SELECT auth.uid() AS uid))))));



  create policy "Admin full access"
  on "public"."familles"
  as permissive
  for all
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Admin full access"
  on "public"."personnes"
  as permissive
  for all
  to public
using ((auth.uid() IS NOT NULL));



  create policy "audit_log_admin_only"
  on "public"."audit_log"
  as permissive
  for all
  to public
using ((auth.uid() IS NOT NULL));



  create policy "Avatars: modification par famille ou admin"
  on "public"."avatars"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM (public.personnes p
     JOIN public.familles f ON ((p.famille_id = f.id)))
  WHERE ((p.id = avatars.personne_id) AND (f.auth_uuid = ( SELECT auth.uid() AS uid))))));



  create policy "Musiques: lecture par famille ou admin"
  on "public"."musiques"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.personnes p
     JOIN public.familles f ON ((p.famille_id = f.id)))
  WHERE ((p.id = musiques.personne_id) AND (f.auth_uuid = ( SELECT auth.uid() AS uid))))));



  create policy "Musiques: suppression par admin"
  on "public"."musiques"
  as permissive
  for delete
  to public
using ((auth.uid() IS NOT NULL));



