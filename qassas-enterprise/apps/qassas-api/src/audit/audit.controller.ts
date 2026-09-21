import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from "@nestjs/common";
import { CurrentActor } from "../auth/current-actor.decorator";
import { KeycloakAuthGuard } from "../auth/keycloak-auth.guard";
import { OpaPolicyService } from "../auth/opa-policy.service";
import type { AuthenticatedActor } from "../auth/auth.types";
import { DatabaseService } from "../database/database.service";
import { AuditQueryService } from "./audit-query.service";

interface DecisionScopeRow {
  target_id: string;
  asset_id: string | null;
  security_class: string;
}

@Controller("audit")
@UseGuards(KeycloakAuthGuard)
export class AuditController {
  constructor(
    private readonly audit: AuditQueryService,
    private readonly database: DatabaseService,
    private readonly policy: OpaPolicyService,
  ) {}

  @Get("objects/:id")
  async history(
    @Param("id") objectId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    const scope = await this.database.query<DecisionScopeRow>(
      `SELECT d.target_id, t.asset_id, t.security_class
         FROM qassas_core.decision_object d
         JOIN qassas_core.target t ON t.target_id = d.target_id
        WHERE d.decision_id = $1
        LIMIT 1`,
      [objectId],
    );

    const row = scope.rows[0];
    if (!row?.asset_id) {
      throw new NotFoundException();
    }

    const allowed = await this.policy.canReadTarget(actor, {
      targetId: row.target_id,
      assetId: row.asset_id,
      securityClass: row.security_class,
    });

    if (!allowed.allow) {
      throw new NotFoundException();
    }

    return this.audit.history(objectId);
  }
}
