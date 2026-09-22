BEGIN;

CREATE TABLE IF NOT EXISTS qassas_core.portfolio_priority_assessment (
  assessment_id text PRIMARY KEY,
  profile_id text NOT NULL
    REFERENCES qassas_core.pilot_asset_profile(profile_id),
  decision_id text
    REFERENCES qassas_core.decision_object(decision_id),
  model_version text NOT NULL,

  geological_potential numeric(5,2) NOT NULL
    CHECK (geological_potential BETWEEN 0 AND 100),
  evidence_confidence numeric(5,2) NOT NULL
    CHECK (evidence_confidence BETWEEN 0 AND 100),
  technical_maturity numeric(5,2) NOT NULL
    CHECK (technical_maturity BETWEEN 0 AND 100),
  scale_potential numeric(5,2) NOT NULL
    CHECK (scale_potential BETWEEN 0 AND 100),
  strategic_adjacency numeric(5,2) NOT NULL
    CHECK (strategic_adjacency BETWEEN 0 AND 100),
  cost_efficiency numeric(5,2) NOT NULL
    CHECK (cost_efficiency BETWEEN 0 AND 100),
  data_quality numeric(5,2) NOT NULL
    CHECK (data_quality BETWEEN 0 AND 100),
  work_commitment_risk numeric(5,2) NOT NULL
    CHECK (work_commitment_risk BETWEEN 0 AND 100),
  partner_constraint numeric(5,2) NOT NULL
    CHECK (partner_constraint BETWEEN 0 AND 100),

  next_decision_cost_sar numeric(18,2) NOT NULL
    CHECK (next_decision_cost_sar > 0),
  expected_information_gain_points numeric(7,3) NOT NULL
    CHECK (expected_information_gain_points BETWEEN 0 AND 100),

  priority_index numeric(7,3) GENERATED ALWAYS AS (
      geological_potential * 0.20
    + evidence_confidence * 0.15
    + technical_maturity * 0.10
    + scale_potential * 0.15
    + strategic_adjacency * 0.10
    + cost_efficiency * 0.10
    + data_quality * 0.10
    + (100 - work_commitment_risk) * 0.05
    + (100 - partner_constraint) * 0.05
  ) STORED,

  voi_points_per_million_sar numeric(18,6) GENERATED ALWAYS AS (
    expected_information_gain_points * 1000000.0 / next_decision_cost_sar
  ) STORED,

  rationale text NOT NULL,
  assessed_by_user_id text
    REFERENCES qassas_security.user_identity(user_id),
  supersedes_assessment_id text
    REFERENCES qassas_core.portfolio_priority_assessment(assessment_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_priority_profile_created
  ON qassas_core.portfolio_priority_assessment(profile_id, created_at DESC);

CREATE OR REPLACE VIEW qassas_core.portfolio_intelligence_latest AS
SELECT
  q.*,
  a.assessment_id,
  a.model_version,
  a.geological_potential,
  a.evidence_confidence,
  a.technical_maturity,
  a.scale_potential,
  a.strategic_adjacency,
  a.cost_efficiency,
  a.data_quality,
  a.work_commitment_risk AS priority_work_commitment_risk,
  a.partner_constraint,
  a.next_decision_cost_sar,
  a.expected_information_gain_points,
  a.priority_index,
  a.voi_points_per_million_sar,
  a.rationale AS priority_rationale,
  a.assessed_by_user_id,
  a.created_at AS priority_assessed_at
FROM qassas_core.pilot_decision_queue q
LEFT JOIN LATERAL (
  SELECT *
    FROM qassas_core.portfolio_priority_assessment pa
   WHERE pa.profile_id = q.profile_id
   ORDER BY pa.created_at DESC, pa.assessment_id DESC
   LIMIT 1
) a ON true;

COMMIT;
