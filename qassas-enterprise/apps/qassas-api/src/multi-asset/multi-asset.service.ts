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
