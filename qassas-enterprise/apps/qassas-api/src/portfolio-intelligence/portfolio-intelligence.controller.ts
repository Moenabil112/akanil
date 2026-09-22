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
  type CreateScenarioCommand,
  type CreateTargetAssessmentCommand,
} from "./portfolio-intelligence.types";
import { PortfolioIntelligenceService } from "./portfolio-intelligence.service";

@Controller("portfolio-intelligence")
@UseGuards(KeycloakAuthGuard)
export class PortfolioIntelligenceController {
  constructor(
    private readonly intelligence: PortfolioIntelligenceService,
  ) {}

  @Get("control-board")
  controlBoard(@CurrentActor() actor: AuthenticatedActor) {
    return this.intelligence.controlBoard(actor);
  }

  @Get("board")
  boardView(@CurrentActor() actor: AuthenticatedActor) {
    return this.intelligence.boardView(actor);
  }

  @Get("exploration")
  explorationView(@CurrentActor() actor: AuthenticatedActor) {
    return this.intelligence.explorationView(actor);
  }

  @Get("finance")
  financeView(@CurrentActor() actor: AuthenticatedActor) {
    return this.intelligence.financeView(actor);
  }

  @Get("assets/:assetId")
  getAsset(
    @Param("assetId") assetId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.intelligence.getAsset(assetId, actor);
  }

  @Get("reassessments/assets/:assetId")
  reassessmentHistory(
    @Param("assetId") assetId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.intelligence.reassessmentHistory(assetId, actor);
  }

  @Post("target-assessments")
  createAssessment(
    @Body() body: CreateTargetAssessmentCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.intelligence.createAssessment(
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post("scenarios")
  createScenario(
    @Body() body: CreateScenarioCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.intelligence.createScenario(
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
