
-- Bot state for tracking getUpdates offset
CREATE TABLE public.telegram_bot_state (
  id int PRIMARY KEY CHECK (id = 1),
  update_offset bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

-- Incoming telegram messages
CREATE TABLE public.telegram_messages (
  update_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  text text,
  raw_update jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages (chat_id);
CREATE INDEX idx_telegram_messages_processed ON public.telegram_messages (processed) WHERE NOT processed;

-- RLS
ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

-- Only service role can access these (edge functions use service role)
CREATE POLICY "Service role only" ON public.telegram_bot_state FOR ALL TO service_role USING (true);
CREATE POLICY "Service role only" ON public.telegram_messages FOR ALL TO service_role USING (true);
-- Admins can view telegram messages
CREATE POLICY "Admins can view telegram messages" ON public.telegram_messages FOR SELECT TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role));
