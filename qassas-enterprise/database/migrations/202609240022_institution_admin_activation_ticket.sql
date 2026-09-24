BEGIN;

CREATE TABLE IF NOT EXISTS qassas_security.institution_admin_activation_ticket (
  ticket_id text PRIMARY KEY,
  institution_id text NOT NULL REFERENCES qassas_core.institution(institution_id),
  account_id text NOT NULL REFERENCES qassas_security.institution_account(account_id),
  expected_email text NOT NULL,
  activation_secret_hash text NOT NULL,
  ticket_status text NOT NULL CHECK (
    ticket_status IN ('PENDING','CLAIMED','REVOKED','EXPIRED')
  ),
  created_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  claimed_by_user_id text REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  revoked_at timestamptz,
  correlation_id text NOT NULL,
  CHECK (expected_email = lower(expected_email)),
  CHECK (expires_at > created_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_institution_admin_pending_ticket
  ON qassas_security.institution_admin_activation_ticket(institution_id)
  WHERE ticket_status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_institution_admin_activation_ticket_account
  ON qassas_security.institution_admin_activation_ticket(account_id, ticket_status);

CREATE OR REPLACE FUNCTION qassas_security.deny_activation_ticket_secret_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.activation_secret_hash IS DISTINCT FROM NEW.activation_secret_hash
     OR OLD.expected_email IS DISTINCT FROM NEW.expected_email
     OR OLD.institution_id IS DISTINCT FROM NEW.institution_id
     OR OLD.account_id IS DISTINCT FROM NEW.account_id
     OR OLD.created_by_user_id IS DISTINCT FROM NEW.created_by_user_id
     OR OLD.created_at IS DISTINCT FROM NEW.created_at
     OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
     OR OLD.correlation_id IS DISTINCT FROM NEW.correlation_id THEN
    RAISE EXCEPTION 'Activation ticket identity fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS institution_admin_activation_ticket_identity_immutable
  ON qassas_security.institution_admin_activation_ticket;
CREATE TRIGGER institution_admin_activation_ticket_identity_immutable
BEFORE UPDATE ON qassas_security.institution_admin_activation_ticket
FOR EACH ROW
EXECUTE FUNCTION qassas_security.deny_activation_ticket_secret_mutation();

CREATE OR REPLACE VIEW qassas_security.institution_admin_activation_status AS
SELECT
  i.institution_id,
  i.enterprise_id,
  i.display_name,
  a.account_id,
  a.account_name,
  a.iam_binding_status,
  a.status AS account_status,
  a.primary_admin_user_id,
  a.activated_at,
  t.ticket_id,
  t.expected_email,
  CASE
    WHEN t.ticket_status = 'PENDING' AND t.expires_at <= now() THEN 'EXPIRED'
    ELSE t.ticket_status
  END AS ticket_status,
  t.created_at AS ticket_created_at,
  t.expires_at AS ticket_expires_at,
  t.claimed_at AS ticket_claimed_at,
  CASE
    WHEN a.status = 'ACTIVE'
      AND a.iam_binding_status = 'BOUND'
      AND a.primary_admin_user_id IS NOT NULL
      THEN true
    ELSE false
  END AS login_enabled
FROM qassas_core.institution i
JOIN qassas_security.institution_account a
  ON a.institution_id = i.institution_id
LEFT JOIN LATERAL (
  SELECT ticket_id, expected_email, ticket_status,
         created_at, expires_at, claimed_at
  FROM qassas_security.institution_admin_activation_ticket t0
  WHERE t0.institution_id = i.institution_id
  ORDER BY t0.created_at DESC, t0.ticket_id DESC
  LIMIT 1
) t ON true;

COMMIT;
