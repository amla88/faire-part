-- Ajoute le comptage des présences anniversaire à la vue stats_rapides (tableau admin).

DROP VIEW IF EXISTS public.stats_rapides;

CREATE OR REPLACE VIEW public.stats_rapides AS
SELECT
  (SELECT count(*) FROM public.familles) AS nb_familles,
  (SELECT count(*) FROM public.personnes) AS nb_personnes,
  (SELECT count(*) FROM public.avatars) AS nb_avatars_crees,
  (SELECT count(*) FROM public.musiques) AS nb_musiques_proposees,
  (SELECT count(*) FROM public.personnes WHERE present_reception = true) AS confirmations_reception,
  (SELECT count(*) FROM public.personnes WHERE present_repas = true) AS confirmations_repas,
  (SELECT count(*) FROM public.personnes WHERE present_soiree = true) AS confirmations_soiree,
  (SELECT count(*) FROM public.personnes WHERE present_anniversaire = true) AS confirmations_anniversaire;
