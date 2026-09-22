import { Injectable } from "@nestjs/common";
import type { AuthenticatedActor } from "./auth.types";

export interface PolicyDecision {
  allow: boolean;
  reason: string;
}

@Injectable()
export class OpaPolicyService {
  private baseUrl(): string {
    return (process.env.OPA_URL ?? "http://127.0.0.1:8181").replace(/\/$/, "");
  }

  private subject(actor: AuthenticatedActor) {
    return {
      user_id: actor.userId,
      role_assignments: actor.roleAssignments.map((ra) => ({
        role_assignment_id: ra.roleAssignmentId,
        role_type: ra.roleType,
        asset_scope: ra.assetScope,
        jv_scope: ra.jvScope,
        decision_class_scope: ra.decisionClassScope,
        capital_threshold: ra.capitalThreshold,
        security_clearance: ra.securityClearance,
        effective_from: ra.effectiveFrom,
        effective_to: ra.effectiveTo,
        status: ra.status,
      })),
    };
  }

  private async evaluate(
    packagePath: string,
    input: Record<string, unknown>,
  ): Promise<PolicyDecision> {
    try {
      const response = await fetch(
        `${this.baseUrl()}/v1/data/${packagePath}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input }),
        },
      );

      if (!response.ok) {
        return { allow: false, reason: "POLICY_ENGINE_UNAVAILABLE" };
      }

      const body = (await response.json()) as {
        result?: { allow?: boolean; reason?: string };
      };

      return {
        allow: body.result?.allow === true,
        reason: body.result?.reason ?? "DEFAULT_DENY",
      };
    } catch {
      return { allow: false, reason: "POLICY_ENGINE_UNAVAILABLE" };
    }
  }

  canReadTarget(
    actor: AuthenticatedActor,
    object: {
      targetId: string;
      assetId: string;
      securityClass: string;
    },
  ): Promise<PolicyDecision> {
    return this.evaluate("qassas/target", {
      action: "read",
      subject: this.subject(actor),
      object: {
        object_type: "Target",
        target_id: object.targetId,
        asset_id: object.assetId,
        security_class: object.securityClass,
      },
    });
  }

  canActOnEvidence(
    actor: AuthenticatedActor,
    action:
      | "register"
      | "qualify"
      | "create_snapshot"
      | "open_gap"
      | "open_conflict",
    object: {
      targetId: string;
      assetId: string;
      securityClass: string;
      evidenceId?: string;
    },
  ): Promise<PolicyDecision> {
    return this.evaluate("qassas/evidence", {
      action,
      subject: this.subject(actor),
      object: {
        object_type: "EvidenceGovernance",
        target_id: object.targetId,
        asset_id: object.assetId,
        security_class: object.securityClass,
        evidence_id: object.evidenceId ?? null,
      },
    });
  }

  canActOnRecommendation(
    actor: AuthenticatedActor,
    action:
      | "create_action"
      | "propose_test"
      | "issue_recommendation"
      | "review_recommendation",
    object: {
      decisionId: string;
      targetId: string;
      assetId: string;
      decisionClass: string;
      recommendationCreatedByUserId?: string | null;
    },
  ): Promise<PolicyDecision> {
    return this.evaluate("qassas/recommendation", {
      action,
      subject: this.subject(actor),
      object: {
        object_type: "DecisionIntelligence",
        decision_id: object.decisionId,
        target_id: object.targetId,
        asset_id: object.assetId,
        decision_class: object.decisionClass,
        recommendation_created_by_user_id:
          object.recommendationCreatedByUserId ?? null,
      },
    });
  }

  canActOnRights(
    actor: AuthenticatedActor,
    action:
      | "register_licence"
      | "add_party_role"
      | "define_jv_constraint"
      | "record_consent"
      | "create_work_commitment"
      | "update_work_commitment"
      | "assess_constraints"
      | "read_rights",
    object: {
      assetId: string;
      jvId?: string | null;
    },
  ): Promise<PolicyDecision> {
    return this.evaluate("qassas/rights", {
      action,
      subject: this.subject(actor),
      object: {
        object_type: "RightsGovernance",
        asset_id: object.assetId,
        jv_id: object.jvId ?? null,
      },
    });
  }

  canActOnDecision(
    actor: AuthenticatedActor,
    action:
      | "open"
      | "bind_evidence"
      | "request_review"
      | "approve"
      | "reject",
    object: {
      decisionId?: string;
      targetId: string;
      assetId: string;
      decisionClass: string;
      createdByUserId?: string | null;
    },
  ): Promise<PolicyDecision> {
    return this.evaluate("qassas/decision", {
      action,
      subject: this.subject(actor),
      object: {
        object_type: "DecisionObject",
        decision_id: object.decisionId ?? null,
        target_id: object.targetId,
        asset_id: object.assetId,
        decision_class: object.decisionClass,
        created_by_user_id: object.createdByUserId ?? null,
      },
    });
  }
}
