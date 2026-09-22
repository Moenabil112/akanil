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
import { RecommendationService } from "./recommendation.service";
import type {
  CreateCandidateActionCommand,
  IssueRecommendationCommand,
  ProposeNextBestTestCommand,
} from "./recommendation.types";

@Controller("decisions")
@UseGuards(KeycloakAuthGuard)
export class RecommendationController {
  constructor(private readonly recommendations: RecommendationService) {}

  @Get(":id/intelligence")
  getIntelligence(
    @Param("id") decisionId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.recommendations.getIntelligence(decisionId, actor);
  }

  @Post(":id/candidate-actions")
  createAction(
    @Param("id") decisionId: string,
    @Body() body: CreateCandidateActionCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.recommendations.createCandidateAction(
      decisionId,
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post(":id/next-best-tests")
  proposeTest(
    @Param("id") decisionId: string,
    @Body() body: ProposeNextBestTestCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.recommendations.proposeNextBestTest(
      decisionId,
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post(":id/recommendations")
  issueRecommendation(
    @Param("id") decisionId: string,
    @Body() body: IssueRecommendationCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.recommendations.issueRecommendation(
      decisionId,
      actor,
      body,
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
}
