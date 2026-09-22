BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.portfolio_scoring_model (
  model_code text NOT NULL,
  model_version integer NOT NULL,
  model_name text NOT NULL,
  w_geological_potential numeric NOT NULL CHECK (w_geological_potential BETWEEN 0 AND 1),
  w_evidence_confidence numeric NOT NULL CHECK (w_evidence_confidence BETWEEN 0 AND 1),
  w_technical_maturity numeric NOT NULL CHECK (w_technical_maturity BETWEEN 0 AND 1),
  w_scale_potential numeric NOT NULL CHECK (w_scale_potential BETWEEN 0 AND 1),
  w_strategic_adjacency numeric NOT NULL CHECK (w_strategic_adjacency BETWEEN 0 AND 1),
  w_cost_to_next_decision numeric NOT NULL CHECK (w_cost_to_next_decision BETWEEN 0 AND 1),
  w_work_commitment_risk numeric NOT NULL CHECK (w_work_commitment_risk BETWEEN 0 AND 1),
  w_partner_constraint numeric NOT NULL CHECK (w_partner_constraint BETWEEN 0 AND 1),
  w_data_quality numeric NOT NULL CHECK (w_data_quality BETWEEN 0 AND 1),
  active boolean NOT NULL DEFAULT false,
  rationale text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (model_code, model_version),
  CHECK (
    w_geological_potential +
    w_evidence_confidence +
    w_technical_maturity +
    w_scale_potential +
    w_strategic_adjacency +
    w_cost_to_next_decision +
    w_work_commitment_risk +
    w_partner_constraint +
    w_data_quality = 1
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_portfolio_scoring_model
  ON qassas_core.portfolio_scoring_model(model_code)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS qassas_core.target_assessment (
  assessment_id text PRIMARY KEY,
  target_id text NOT NULL REFERENCES qassas_core.target(target_id),
  decision_id text REFERENCES qassas_core.decision_object(decision_id),
  assessment_version integer NOT NULL CHECK (assessment_version > 0),

  geological_potential numeric NOT NULL CHECK (geological_potential BETWEEN 0 AND 100),
  evidence_confidence numeric NOT NULL CHECK (evidence_confidence BETWEEN 0 AND 100),
  technical_maturity numeric NOT NULL CHECK (technical_maturity BETWEEN 0 AND 100),
  scale_potential numeric NOT NULL CHECK (scale_potential BETWEEN 0 AND 100),
  strategic_adjacency numeric NOT NULL CHECK (strategic_adjacency BETWEEN 0 AND 100),

  -- Negative dimensions: 0 = favourable / low burden, 100 = highest burden.
  cost_to_next_decision_score numeric NOT NULL CHECK (cost_to_next_decision_score BETWEEN 0 AND 100),
  work_commitment_risk_score numeric NOT NULL CHECK (work_commitment_risk_score BETWEEN 0 AND 100),
  partner_constraint_score numeric NOT NULL CHECK (partner_constraint_score BETWEEN 0 AND 100),

  data_quality numeric NOT NULL CHECK (data_quality BETWEEN 0 AND 100),

  cost_to_next_decision_sar numeric NOT NULL CHECK (cost_to_next_decision_sar > 0),
  expected_information_gain numeric NOT NULL CHECK (expected_information_gain BETWEEN 0 AND 100),

  evidence_snapshot_id text,
  rationale jsonb NOT NULL DEFAULT '{}'::jsonb,
  assessed_by_user_id text NOT NULL REFERENCES qassas_security.user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (target_id, assessment_version)
);

CREATE INDEX IF NOT EXISTS idx_target_assessment_latest
  ON qassas_core.target_assessment(target_id, assessment_version DESC);

CREATE OR REPLACE FUNCTION qassas_core.deny_target_assessment_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'TargetAssessment history is immutable';
END;
$$;

DROP TRIGGER IF EXISTS target_assessment_no_mutation
  ON qassas_core.target_assessment;
CREATE TRIGGER target_assessment_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.target_assessment
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_target_assessment_mutation();

CREATE OR REPLACE VIEW qassas_core.portfolio_intelligence_read_model AS
WITH latest_assessment AS (
  SELECT DISTINCT ON (ta.target_id)
    ta.*
  FROM qassas_core.target_assessment ta
  ORDER BY ta.target_id, ta.assessment_version DESC, ta.created_at DESC
),
active_model AS (
  SELECT *
  FROM qassas_core.portfolio_scoring_model
  WHERE model_code = 'PPI'
    AND active = true
  ORDER BY model_version DESC
  LIMIT 1
),
scored AS (
  SELECT
    q.*,
    ta.assessment_id,
    ta.assessment_version,
    ta.geological_potential,
    ta.evidence_confidence,
    ta.technical_maturity,
    ta.scale_potential,
    ta.strategic_adjacency,
    ta.cost_to_next_decision_score,
    ta.work_commitment_risk_score,
    ta.partner_constraint_score,
    ta.data_quality,
    ta.cost_to_next_decision_sar,
    ta.expected_information_gain,
    ta.evidence_snapshot_id AS assessment_evidence_snapshot_id,
    ta.rationale AS assessment_rationale,
    m.model_code,
    m.model_version,
    ROUND((
      ta.geological_potential * m.w_geological_potential +
      ta.evidence_confidence * m.w_evidence_confidence +
      ta.technical_maturity * m.w_technical_maturity +
      ta.scale_potential * m.w_scale_potential +
      ta.strategic_adjacency * m.w_strategic_adjacency +
      (100 - ta.cost_to_next_decision_score) * m.w_cost_to_next_decision +
      (100 - ta.work_commitment_risk_score) * m.w_work_commitment_risk +
      (100 - ta.partner_constraint_score) * m.w_partner_constraint +
      ta.data_quality * m.w_data_quality
    )::numeric, 2) AS portfolio_priority_index,
    ROUND((
      ta.expected_information_gain / ta.cost_to_next_decision_sar * 1000000
    )::numeric, 4) AS voi_points_per_million_sar,
    CASE
      WHEN q.decision_id IS NULL THEN 'NOT_STARTED'
      WHEN COALESCE(q.blocking_conflict_count, 0) > 0 THEN 'BLOCKED_EVIDENCE_CONFLICT'
      WHEN COALESCE(q.blocking_gap_count, 0) > 0 THEN 'BLOCKED_DATA_GAP'
      WHEN COALESCE(q.licence_at_risk, false) THEN 'BLOCKED_LICENCE_RISK'
      WHEN COALESCE(q.partner_approval_required, false) THEN 'BLOCKED_PARTNER_CONSENT'
      WHEN q.capital_state = 'BLOCKED' THEN 'BLOCKED_CAPITAL'
      WHEN q.queue_state = 'EXECUTION_FUNDED' THEN 'EXECUTION_FUNDED'
      WHEN q.queue_state = 'ACTIONABLE' THEN 'ACTIONABLE'
      ELSE 'GOVERNED_REVIEW'
    END AS governance_state
  FROM qassas_core.pilot_decision_queue q
  LEFT JOIN latest_assessment ta
    ON ta.target_id = q.primary_target_id
  CROSS JOIN active_model m
  WHERE q.pilot_status = 'ACTIVE'
)
SELECT
  s.*,
  CASE
    WHEN s.portfolio_priority_index IS NULL THEN NULL
    ELSE DENSE_RANK() OVER (
      ORDER BY s.portfolio_priority_index DESC NULLS LAST, s.display_order
    )
  END AS priority_rank,
  false AS score_authorises_execution
FROM scored s;

COMMIT;
