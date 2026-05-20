
CREATE TABLE public.partner_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name text NOT NULL,
  api_key text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  is_active boolean NOT NULL DEFAULT true,
  permissions text[] NOT NULL DEFAULT ARRAY['add_lead'],
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE public.partner_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage partner API keys"
  ON public.partner_api_keys FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
