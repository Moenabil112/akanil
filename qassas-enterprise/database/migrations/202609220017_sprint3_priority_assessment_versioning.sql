BEGIN;

ALTER TABLE qassas_core.portfolio_priority_assessment
  ADD COLUMN IF NOT EXISTS assessment_version integer NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_portfolio_priority_profile_version
  ON qassas_core.portfolio_priority_assessment(
    profile_id, assessment_version
  );

DROP TRIGGER IF EXISTS portfolio_priority_assessment_no_mutation
  ON qassas_core.portfolio_priority_assessment;

CREATE TRIGGER portfolio_priority_assessment_no_mutation
BEFORE UPDATE OR DELETE ON qassas_core.portfolio_priority_assessment
FOR EACH ROW EXECUTE FUNCTION qassas_core.deny_decision_intelligence_mutation();

COMMIT;
