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
import { TargetRepository } from "./target.repository";

@Controller("targets")
@UseGuards(KeycloakAuthGuard)
export class TargetController {
  constructor(
    private readonly targets: TargetRepository,
    private readonly policy: OpaPolicyService,
  ) {}

  @Get(":id")
  async getTarget(
    @Param("id") targetId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    const target = await this.targets.findById(targetId);
    if (!target) {
      throw new NotFoundException();
    }

    const decision = await this.policy.canReadTarget(actor, {
      targetId: target.targetId,
      assetId: target.assetId,
      securityClass: target.securityClass,
    });

    if (!decision.allow) {
      // Deliberately conceal object existence from unauthorised callers.
      throw new NotFoundException();
    }

    return {
      target_id: target.targetId,
      enterprise_id: target.enterpriseId,
      prospect_id: target.prospectId,
      asset_id: target.assetId,
      name: target.name,
      current_gate: target.currentGate,
      operational_state: target.operationalState,
      target_status: target.targetStatus,
      security_class: target.securityClass,
      version: target.version,
    };
  }
}
