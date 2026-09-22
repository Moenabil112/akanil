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
import { PortfolioChangeService } from "./portfolio-change.service";
import { PortfolioIntelligenceService } from "./portfolio-intelligence.service";
import { PortfolioReassessmentService } from "./portfolio-reassessment.service";

@Controller("portfolio-intelligence")
@UseGuards(KeycloakAuthGuard)
export class PortfolioIntelligenceController {
  constructor(
    private readonly intelligence: PortfolioIntelligenceService,
    private readonly changes: PortfolioChangeService,
    private readonly reassessment: PortfolioReassessmentService,
  ) {}

  @Get("priority-queue")
  priorityQueue(@CurrentActor() actor: AuthenticatedActor) {
    return this.intelligence.priorityQueue(actor);
  }

  @Get("control-board")
  controlBoard(@CurrentActor() actor: AuthenticatedActor) {
    return this.intelligence.controlBoard(actor);
  }

  @Get("change-feed")
  changeFeed(@CurrentActor() actor: AuthenticatedActor) {
    return this.changes.changeFeed(actor);
  }

  @Get("assets/:assetId")
  getAsset(
    @Param("assetId") assetId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.intelligence.getAsset(assetId, actor);
  }

  @Post("reassessment-snapshots")
  createReassessmentSnapshot(
    @Body() body: { trigger_type?: string; source_event_refs?: string[] },
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    if (!body.trigger_type?.trim()) {
      throw new BadRequestException("trigger_type is required");
    }
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException("X-Qassas-Idempotency-Key is required");
    }
    return this.reassessment.createSnapshot(
      actor,
      body.trigger_type.trim(),
      body.source_event_refs ?? [],
      idempotencyKey.trim(),
      correlationId || "CORR-" + randomUUID(),
    );
  }

  @Get("reassessment-snapshots")
  listReassessmentSnapshots(@CurrentActor() actor: AuthenticatedActor) {
    return this.reassessment.listSnapshots(actor);
  }

  @Get("reassessment-snapshots/:snapshotId")
  getReassessmentSnapshot(
    @Param("snapshotId") snapshotId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.reassessment.getSnapshot(snapshotId, actor);
  }
}
