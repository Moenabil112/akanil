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

  async canReadTarget(
    actor: AuthenticatedActor,
    object: {
      targetId: string;
      assetId: string;
      securityClass: string;
    },
  ): Promise<PolicyDecision> {
    try {
      const response = await fetch(
        `${this.baseUrl()}/v1/data/qassas/target/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            input: {
              action: "read",
              subject: {
                user_id: actor.userId,
                role_assignments: actor.roleAssignments.map((ra) => ({
                  role_assignment_id: ra.roleAssignmentId,
                  role_type: ra.roleType,
                  asset_scope: ra.assetScope,
                  jv_scope: ra.jvScope,
                  security_clearance: ra.securityClearance,
                  effective_from: ra.effectiveFrom,
                  effective_to: ra.effectiveTo,
                  status: ra.status,
                })),
              },
              object: {
                object_type: "Target",
                target_id: object.targetId,
                asset_id: object.assetId,
                security_class: object.securityClass,
              },
            },
          }),
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
}
