WITH ranked_phone AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at ASC) as rn
  FROM public.leads
  WHERE phone IS NOT NULL AND phone <> ''
)
DELETE FROM public.leads WHERE id IN (SELECT id FROM ranked_phone WHERE rn > 1);

WITH ranked_email AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at ASC) as rn
  FROM public.leads
  WHERE email IS NOT NULL AND email <> ''
)
DELETE FROM public.leads WHERE id IN (SELECT id FROM ranked_email WHERE rn > 1);