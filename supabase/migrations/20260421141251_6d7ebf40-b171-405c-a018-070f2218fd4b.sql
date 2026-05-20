DELETE FROM activity_logs WHERE lead_id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY COALESCE(phone,''), COALESCE(email,'') ORDER BY created_at ASC) as rn
    FROM leads WHERE created_at >= CURRENT_DATE
  ) t WHERE rn > 1
);
DELETE FROM lead_notes WHERE lead_id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY COALESCE(phone,''), COALESCE(email,'') ORDER BY created_at ASC) as rn
    FROM leads WHERE created_at >= CURRENT_DATE
  ) t WHERE rn > 1
);
DELETE FROM lead_assignments WHERE lead_id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY COALESCE(phone,''), COALESCE(email,'') ORDER BY created_at ASC) as rn
    FROM leads WHERE created_at >= CURRENT_DATE
  ) t WHERE rn > 1
);
DELETE FROM leads WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY COALESCE(phone,''), COALESCE(email,'') ORDER BY created_at ASC) as rn
    FROM leads WHERE created_at >= CURRENT_DATE
  ) t WHERE rn > 1
);