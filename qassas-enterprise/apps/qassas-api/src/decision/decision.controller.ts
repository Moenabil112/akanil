import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Body,
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
import {
  DecisionService,
  type OpenDecisionCommand,
} from "./decision.service";

@Controller("decisions")
@UseGuards(KeycloakAuthGuard)
export class DecisionController {
  constructor(private readonly decisions: DecisionService) {}

  @Get(":id")
  getDecision(
    @Param("id") decisionId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.decisions.getDecision(decisionId, actor);
  }

  @Post()
  openDecision(
    @Body() body: OpenDecisionCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.decisions.openDecision(
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post(":id/reviews")
  requestReview(
    @Param("id") decisionId: string,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("if-match") ifMatch?: string,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.decisions.requestHumanReview(
      decisionId,
      actor,
      this.expectedVersion(ifMatch),
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post(":id/approve")
  approve(
    @Param("id") decisionId: string,
    @Body() body: { rationale?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("if-match") ifMatch?: string,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.decisions.approveDecision(
      decisionId,
      actor,
      this.expectedVersion(ifMatch),
      body.rationale ?? "",
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post(":id/reject")
  reject(
    @Param("id") decisionId: string,
    @Body() body: { rationale?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("if-match") ifMatch?: string,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.decisions.rejectDecision(
      decisionId,
      actor,
      this.expectedVersion(ifMatch),
      body.rationale ?? "",
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
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
