CREATE TABLE IF NOT EXISTS public.study_hub_document_payments (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL CHECK (char_length(resource_id) BETWEEN 1 AND 2048),
  resource_title TEXT NOT NULL CHECK (char_length(resource_title) BETWEEN 1 AND 500),
  delivery_url TEXT,
  amount_ugx INTEGER NOT NULL CHECK (amount_ugx = 1000),
  sender_phone VARCHAR(20) NOT NULL,
  transaction_id VARCHAR(100) NOT NULL,
  payer_sms TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'sending', 'approved', 'rejected')),
  received_sender_phone VARCHAR(20),
  received_recipient_phone VARCHAR(20),
  received_amount_ugx INTEGER,
  received_transaction_id VARCHAR(100),
  received_sms TEXT,
  verified_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.study_hub_document_payments
  ADD COLUMN IF NOT EXISTS delivery_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS study_hub_document_payments_transaction_id_unique
  ON public.study_hub_document_payments (upper(btrim(transaction_id)));

CREATE INDEX IF NOT EXISTS study_hub_document_payments_user_created_idx
  ON public.study_hub_document_payments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS study_hub_document_payments_status_created_idx
  ON public.study_hub_document_payments (status, created_at DESC);
