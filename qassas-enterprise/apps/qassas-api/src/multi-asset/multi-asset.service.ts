import { Injectable, NotFoundException } from "@nestjs/common";
import { OpaPolicyService } from "../auth/opa-policy.service";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";
import type {
  PilotQueueRow,
  WorkflowTemplateRow,
} from "./multi-asset.types";

interface AssetDetailRow extends PilotQueueRow {
  template_name: string;
  initial_gate: string;
  required_evidence_classes: string[];
  default_reviewer_role: string;
  rule_set_version: string;
  template_configuration: Record<string, unknown>;
  asset_configuration: Record<string, unknown>;
}

@Injectable()
export class MultiAssetService {
  constructor(
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
  ) {}

  async listAssets(actor: AuthenticatedActor) {
    const result = await this.database.query<AssetDetailRow>(
      this.assetQuery() + " ORDER BY p.display_order",
    );

    const visible = await this.authorisedRows(actor, result.rows);

    return {
      visible_asset_count: visible.length,
      assets: visible.map((row) => this.assetView(row)),
    };
  }

  async getAsset(assetId: string, actor: AuthenticatedActor) {
    const result = await this.database.query<AssetDetailRow>(
      this.assetQuery() + " WHERE p.asset_id = $1 LIMIT 1",
      [assetId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException();

    const allowed = await this.canRead(actor, row);
    if (!allowed) throw new NotFoundException();

    return this.assetView(row);
  }

  async decisionQueue(actor: AuthenticatedActor) {
    const result = await this.database.query<PilotQueueRow>(
      "SELECT * FROM qassas_core.pilot_decision_queue WHERE pilot_status = 'ACTIVE' ORDER BY display_order",
    );

    const visible = await this.authorisedRows(actor, result.rows);

    const states = visible.reduce<Record<string, number>>((acc, row) => {
      acc[row.queue_state] = (acc[row.queue_state] ?? 0) + 1;
      return acc;
    }, {});

    return {
      visible_asset_count: visible.length,
      queue_state_counts: states,
      decisions: visible.map((row) => this.queueView(row)),
    };
  }

  async listWorkflowTemplates(actor: AuthenticatedActor) {
    const assets = await this.database.query<PilotQueueRow>(
      "SELECT * FROM qassas_core.pilot_decision_queue WHERE pilot_status = 'ACTIVE' ORDER BY display_order",
    );
    const visible = await this.authorisedRows(actor, assets.rows);
    const allowedTemplateCodes = new Set(
      visible.map((row) => row.workflow_template_code),
    );

    if (!allowedTemplateCodes.size) {
      return { templates: [] };
    }

    const templates = await this.database.query<WorkflowTemplateRow>(
      "SELECT template_code, template_name, decision_class, initial_gate, required_evidence_classes, default_reviewer_role, rule_set_version, active, configuration FROM qassas_core.workflow_template WHERE active = true ORDER BY template_code",
    );

    return {
      templates: templates.rows
        .filter((row) => allowedTemplateCodes.has(row.template_code))
        .map((row) => ({
          template_code: row.template_code,
          template_name: row.template_name,
          decision_class: row.decision_class,
          initial_gate: row.initial_gate,
          required_evidence_classes: row.required_evidence_classes ?? [],
          default_reviewer_role: row.default_reviewer_role,
          rule_set_version: row.rule_set_version,
          configuration: row.configuration ?? {},
        })),
    };
  }

  async explorationDirectorQueue(actor: AuthenticatedActor) {
    this.requireRole(actor, "EXPLORATION_DIRECTOR");

    const result = await this.database.query<PilotQueueRow>(
      "SELECT * FROM qassas_core.pilot_decision_queue WHERE pilot_status = 'ACTIVE' ORDER BY display_order",
    );
    const visible = await this.authorisedRows(actor, result.rows);

    return {
      interface: "EXPLORATION_DIRECTOR",
      visible_asset_count: visible.length,
      assets: visible.map((row) => ({
        decision_object_key: row.decision_object_key,
        asset_id: row.asset_id,
        asset_name: row.asset_name,
        decision_class: row.decision_class,
        configured_gate: row.configured_gate,
        workflow_template_code: row.workflow_template_code,
        queue_state: row.queue_state,
        decision_id: row.decision_id,
        decision_state: row.decision_state,
        evidence_readiness: row.evidence_control_state ?? "NOT_ASSESSED",
        blocking_gap_count: Number(row.blocking_gap_count ?? 0),
        blocking_conflict_count: Number(row.blocking_conflict_count ?? 0),
        recommendation_review_status: row.recommendation_review_status,
        partner_approval_required: row.partner_approval_required,
        partner_consent_status: row.partner_consent_status,
        work_commitment_risk: row.work_commitment_risk,
        capital_state: row.capital_state,
        portfolio_attention_state: row.portfolio_attention_state,
        next_controlled_action: this.nextControlledAction(row),
      })),
    };
  }

  async financeQueue(actor: AuthenticatedActor) {
    this.requireRole(actor, "FINANCE_REVIEWER");

    const result = await this.database.query<PilotQueueRow>(
      "SELECT * FROM qassas_core.pilot_decision_queue WHERE pilot_status = 'ACTIVE' ORDER BY display_order",
    );
    const visible = await this.authorisedRows(actor, result.rows);

    return {
      interface: "FINANCE",
      visible_asset_count: visible.length,
      assets: visible.map((row) => ({
        decision_object_key: row.decision_object_key,
        asset_id: row.asset_id,
        asset_name: row.asset_name,
        decision_class: row.decision_class,
        queue_state: row.queue_state,
        decision_id: row.decision_id,
        decision_state: row.decision_state,
        rights_blocked:
          row.partner_approval_required === true ||
          row.licence_at_risk === true ||
          row.commitment_at_risk === true,
        partner_approval_required: row.partner_approval_required,
        partner_consent_status: row.partner_consent_status,
        work_commitment_risk: row.work_commitment_risk,
        capital_request_id: row.capital_request_id,
        capital_type: row.capital_type,
        requested_amount:
          row.requested_amount === null ? null : Number(row.requested_amount),
        currency: row.currency,
        capital_state: row.capital_state,
        released_capital_total: Number(row.released_capital_total ?? 0),
        capital_release_count: Number(row.capital_release_count ?? 0),
      })),
    };
  }

  async jvReviewQueue(actor: AuthenticatedActor) {
    this.requireRole(actor, "PARTNER_USER");

    const result = await this.database.query<PilotQueueRow>(
      "SELECT * FROM qassas_core.pilot_decision_queue WHERE pilot_status = 'ACTIVE' ORDER BY display_order",
    );

    const partnerAssets = new Set(
      actor.roleAssignments
        .filter((role) => role.roleType === "PARTNER_USER" && role.status === "ACTIVE")
        .flatMap((role) => role.assetScope),
    );

    const candidateRows = result.rows.filter((row) =>
      partnerAssets.has(row.asset_id),
    );
    const visible = await this.authorisedRows(actor, candidateRows);

    const assets = [];
    for (const row of visible) {
      const partnerRole = actor.roleAssignments.find(
        (role) =>
          role.roleType === "PARTNER_USER" &&
          role.status === "ACTIVE" &&
          role.assetScope.includes(row.asset_id),
      );
      const jvScope = partnerRole?.jvScope ?? [];

      const constraints = await this.database.query<{
        constraint_id: string;
        jv_id: string;
        partner_name: string;
        reserved_matter: string;
        consent_required: boolean;
        voting_threshold: string | null;
        consent_status: string | null;
        effective_until: Date | null;
      }>(
        `SELECT c.constraint_id, c.jv_id, c.partner_name,
                c.reserved_matter, c.consent_required, c.voting_threshold,
                ce.consent_status, ce.effective_until
           FROM qassas_core.jv_constraint c
           LEFT JOIN LATERAL (
             SELECT consent_status, effective_until
               FROM qassas_core.jv_consent_event e
              WHERE e.constraint_id = c.constraint_id
              ORDER BY e.recorded_at DESC, e.consent_event_id DESC
              LIMIT 1
           ) ce ON true
          WHERE c.licence_id = $1
            AND c.jv_id = ANY($2::text[])
          ORDER BY c.constraint_id`,
        [row.asset_id, jvScope],
      );

      const commitments = await this.database.query<{
        commitment_id: string;
        description: string;
        due_date: Date;
        mandatory: boolean;
        status: string;
      }>(
        `SELECT commitment_id, description, due_date, mandatory, status
           FROM qassas_core.work_commitment
          WHERE licence_id = $1
            AND mandatory = true
          ORDER BY due_date, commitment_id`,
        [row.asset_id],
      );

      assets.push({
        decision_object_key: row.decision_object_key,
        asset_id: row.asset_id,
        asset_name: row.asset_name,
        decision_class: row.decision_class,
        queue_state: row.queue_state,
        decision_id: row.decision_id,
        decision_state: row.decision_state,
        reserved_matters: constraints.rows.map((constraint) => ({
          constraint_id: constraint.constraint_id,
          jv_id: constraint.jv_id,
          partner_name: constraint.partner_name,
          reserved_matter: constraint.reserved_matter,
          consent_required: constraint.consent_required,
          voting_threshold: constraint.voting_threshold,
          consent_status: constraint.consent_status ?? "NOT_RECORDED",
          effective_until: constraint.effective_until?.toISOString() ?? null,
        })),
        mandatory_work_commitments: commitments.rows.map((commitment) => ({
          commitment_id: commitment.commitment_id,
          description: commitment.description,
          due_date: commitment.due_date.toISOString().slice(0, 10),
          status: commitment.status,
        })),
      });
    }

    return {
      interface: "JV_REVIEW",
      visible_asset_count: assets.length,
      assets,
    };
  }

  private requireRole(actor: AuthenticatedActor, roleType: string) {
    const now = Date.now();
    const allowed = actor.roleAssignments.some((role) => {
      if (role.roleType !== roleType || role.status !== "ACTIVE") return false;
      const from = Date.parse(role.effectiveFrom);
      const to = role.effectiveTo ? Date.parse(role.effectiveTo) : null;
      return from <= now && (to === null || to > now);
    });

    if (!allowed) {
      throw new NotFoundException();
    }
  }

  private nextControlledAction(row: PilotQueueRow): string {
    if (row.queue_state === "NOT_STARTED") return "OPEN_DECISION";
    if ((row.blocking_conflict_count ?? 0) > 0) return "RESOLVE_EVIDENCE_CONFLICT";
    if ((row.blocking_gap_count ?? 0) > 0) return "CLOSE_BLOCKING_DATA_GAP";
    if (row.partner_approval_required === true) return "OBTAIN_PARTNER_CONSENT";
    if (row.recommendation_id === null) return "ISSUE_RECOMMENDATION";
    if (row.recommendation_review_status !== "APPROVED") return "REVIEW_RECOMMENDATION";
    if (row.capital_request_id === null) return "PREPARE_CAPITAL_REQUEST";
    if (row.capital_state === "APPROVED") return "ASSESS_EXECUTION_RELEASE";
    if (row.capital_state === "RELEASED") return "MONITOR_EXECUTION_OUTCOME";
    return "HUMAN_REVIEW";
  }

  private assetQuery() {
    return [
      "SELECT q.*,",
      "       wt.template_name,",
      "       wt.initial_gate,",
      "       wt.required_evidence_classes,",
      "       wt.default_reviewer_role,",
      "       wt.rule_set_version,",
      "       wt.configuration AS template_configuration,",
      "       p.configuration AS asset_configuration",
      "  FROM qassas_core.pilot_decision_queue q",
      "  JOIN qassas_core.pilot_asset_profile p ON p.profile_id = q.profile_id",
      "  JOIN qassas_core.workflow_template wt ON wt.template_code = p.workflow_template_code",
    ].join(" ");
  }

  private async authorisedRows<T extends PilotQueueRow>(
    actor: AuthenticatedActor,
    rows: T[],
  ): Promise<T[]> {
    const visible: T[] = [];

    for (const row of rows) {
      if (await this.canRead(actor, row)) {
        visible.push(row);
      }
    }

    return visible;
  }

  private async canRead(
    actor: AuthenticatedActor,
    row: Pick<
      PilotQueueRow,
      "primary_target_id" | "asset_id" | "security_class"
    >,
  ) {
    const result = await this.policy.canReadTarget(actor, {
      targetId: row.primary_target_id,
      assetId: row.asset_id,
      securityClass: row.security_class,
    });
    return result.allow;
  }

  private assetView(row: AssetDetailRow) {
    return {
      profile_id: row.profile_id,
      asset_id: row.asset_id,
      asset_name: row.asset_name,
      decision_object_key: row.decision_object_key,
      decision_class: row.decision_class,
      configured_gate: row.configured_gate,
      pilot_status: row.pilot_status,
      security_class: row.security_class,
      primary_target_id: row.primary_target_id,
      secondary_target_ids: row.secondary_target_ids ?? [],
      workflow_template: {
        template_code: row.workflow_template_code,
        template_name: row.template_name,
        initial_gate: row.initial_gate,
        required_evidence_classes: row.required_evidence_classes ?? [],
        default_reviewer_role: row.default_reviewer_role,
        rule_set_version: row.rule_set_version,
        configuration: row.template_configuration ?? {},
      },
      configuration: row.asset_configuration ?? {},
      current_queue_state: row.queue_state,
      current_decision_id: row.decision_id,
    };
  }

  private queueView(row: PilotQueueRow) {
    return {
      display_order: row.display_order,
      decision_object_key: row.decision_object_key,
      asset_id: row.asset_id,
      asset_name: row.asset_name,
      decision_class: row.decision_class,
      workflow_template_code: row.workflow_template_code,
      configured_gate: row.configured_gate,
      primary_target_id: row.primary_target_id,
      secondary_target_ids: row.secondary_target_ids ?? [],
      decision_id: row.decision_id,
      decision_state: row.decision_state,
      decision_gate: row.decision_gate,
      queue_state: row.queue_state,
      evidence: {
        control_state: row.evidence_control_state,
        blocking_gap_count: Number(row.blocking_gap_count ?? 0),
        blocking_conflict_count: Number(row.blocking_conflict_count ?? 0),
      },
      recommendation: {
        recommendation_id: row.recommendation_id,
        review_status: row.recommendation_review_status,
      },
      rights: {
        partner_approval_required: row.partner_approval_required,
        partner_consent_status: row.partner_consent_status,
        work_commitment_risk: row.work_commitment_risk,
        commitment_at_risk: row.commitment_at_risk,
        licence_at_risk: row.licence_at_risk,
        execution_allowed: row.execution_allowed,
      },
      capital: {
        request_id: row.capital_request_id,
        type: row.capital_type,
        requested_amount:
          row.requested_amount === null ? null : Number(row.requested_amount),
        currency: row.currency,
        state: row.capital_state,
        released_total: Number(row.released_capital_total ?? 0),
        release_count: Number(row.capital_release_count ?? 0),
      },
      portfolio_attention_state: row.portfolio_attention_state,
      last_activity_at: row.last_activity_at?.toISOString() ?? null,
    };
  }
}
