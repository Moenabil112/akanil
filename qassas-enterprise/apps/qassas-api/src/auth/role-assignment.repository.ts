import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { RoleAssignment } from "./auth.types";

interface UserRow {
  user_id: string;
  external_subject: string;
}

interface RoleRow {
  role_assignment_id: string;
  role_type: string;
  asset_scope: string[];
  jv_scope: string[];
  decision_class_scope: string[];
  capital_threshold: string | null;
  security_clearance: string;
  effective_from: Date;
  effective_to: Date | null;
  status: string;
}

@Injectable()
export class RoleAssignmentRepository {
  constructor(private readonly database: DatabaseService) {}

  async findActiveActorBySubject(
    externalSubject: string,
  ): Promise<{ userId: string; roleAssignments: RoleAssignment[] } | null> {
    const user = await this.database.query<UserRow>(
      `SELECT user_id, external_subject
         FROM qassas_security.user_identity
        WHERE external_subject = $1
          AND status = 'ACTIVE'
        LIMIT 1`,
      [externalSubject],
    );

    if (!user.rowCount) {
      return null;
    }

    const userId = user.rows[0].user_id;
    const roles = await this.database.query<RoleRow>(
      `SELECT role_assignment_id, role_type, asset_scope, jv_scope,
              decision_class_scope, capital_threshold, security_clearance,
              effective_from, effective_to, status
         FROM qassas_security.role_assignment
        WHERE user_id = $1
          AND status = 'ACTIVE'
          AND effective_from <= now()
          AND (effective_to IS NULL OR effective_to > now())
        ORDER BY role_assignment_id`,
      [userId],
    );

    return {
      userId,
      roleAssignments: roles.rows.map((row) => ({
        roleAssignmentId: row.role_assignment_id,
        roleType: row.role_type,
        assetScope: row.asset_scope ?? [],
        jvScope: row.jv_scope ?? [],
        decisionClassScope: row.decision_class_scope ?? [],
        capitalThreshold: row.capital_threshold,
        securityClearance: row.security_clearance,
        effectiveFrom: row.effective_from.toISOString(),
        effectiveTo: row.effective_to?.toISOString() ?? null,
        status: row.status,
      })),
    };
  }
}
