import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentActor } from "../auth/current-actor.decorator";
import { KeycloakAuthGuard } from "../auth/keycloak-auth.guard";
import type { AuthenticatedActor } from "../auth/auth.types";
import { ConstraintAssessmentService } from "./constraint-assessment.service";

@Controller("decisions")
@UseGuards(KeycloakAuthGuard)
export class ConstraintAssessmentController {
  constructor(private readonly assessments: ConstraintAssessmentService) {}

  @Post(":id/constraint-assessments")
  assess(
    @Param("id") decisionId: string,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("if-match") ifMatch?: string,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.assessments.assess(
      decisionId,
      actor,
      this.expectedVersion(ifMatch),
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Get(":id/constraint-assessments/latest")
  latest(
    @Param("id") decisionId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.assessments.latest(decisionId, actor);
  }

  private requireIdempotency(value?: string) {
    if (!value?.trim()) {
      throw new BadRequestException("X-Qassas-Idempotency-Key is required");
    }
    return value.trim();
  }

  private expectedVersion(value?: string) {
    if (!value?.trim()) {
      throw new BadRequestException("If-Match is required");
    }
    const parsed = Number(value.replaceAll('"', "").trim());
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException("If-Match must be a positive object version");
    }
    return parsed;
  }
}
