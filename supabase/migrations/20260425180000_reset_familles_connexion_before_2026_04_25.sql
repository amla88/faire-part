-- Efface l’horodatage de dernière connexion pour les connexions strictement avant le 25/04/2026 (Europe/Paris).

UPDATE public.familles
SET connexion = NULL
WHERE connexion IS NOT NULL
  AND connexion < timestamptz '2026-04-25 00:00:00 Europe/Paris';
