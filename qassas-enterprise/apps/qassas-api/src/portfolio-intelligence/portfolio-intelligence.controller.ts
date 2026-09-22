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
import { PortfolioAssessmentService } from "./portfolio-assessment.service";
import { PortfolioChangeService } from "./portfolio-change.service";
import { PortfolioIntelligenceService } from "./portfolio-intelligence.service";
import { PortfolioReassessmentService } from "./portfolio-reassessment.service";

@Controller("portfolio-intelligence")
@UseGuards(KeycloakAuthGuard)
export class PortfolioIntelligenceController {
  constructor(
    private readonly intelligence: PortfolioIntelligenceService,
    private readonly assessments: PortfolioAssessmentService,
    private readonly changes: PortfolioChangeService,
    private readonly reassessment: PortfolioReassessmentService,
  ) {}

  @Get("priority-queue")
  priorityQueue(@CurrentActor() actor: AuthenticatedActor) {
    return this.intelligence.priorityQueue(actor);
  }

  @Get("control-board")
  async controlBoard(@CurrentActor() actor: AuthenticatedActor) {
    const [board, changeFeed] = await Promise.all([
      this.intelligence.controlBoard(actor),
      this.changes.changeFeed(actor),
    ]);
    return {
      ...board,
      change_intelligence: {
        visible_change_count: changeFeed.visible_change_count,
        recent_changes: changeFeed.changes.slice(0, 10),
      },
    };
  }

  @Post("assessments")
  createPriorityAssessment(
    @Body() body: {
      asset_id?: string;
      geological_potential?: number;
      evidence_confidence?: number;
      technical_maturity?: number;
      scale_potential?: number;
      strategic_adjacency?: number;
      cost_efficiency?: number;
      data_quality?: number;
      work_commitment_risk?: number;
      partner_constraint?: number;
      next_decision_cost_sar?: number;
      expected_information_gain_points?: number;
      rationale?: string;
    },
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    if (!body.asset_id?.trim()) {
      throw new BadRequestException("asset_id is required");
    }
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException("X-Qassas-Idempotency-Key is required");
    }
    return this.assessments.createAssessment(
      actor,
      {
        asset_id: body.asset_id.trim(),
        geological_potential: Number(body.geological_potential),
        evidence_confidence: Number(body.evidence_confidence),
        technical_maturity: Number(body.technical_maturity),
        scale_potential: Number(body.scale_potential),
        strategic_adjacency: Number(body.strategic_adjacency),
        cost_efficiency: Number(body.cost_efficiency),
        data_quality: Number(body.data_quality),
        work_commitment_risk: Number(body.work_commitment_risk),
        partner_constraint: Number(body.partner_constraint),
        next_decision_cost_sar: Number(body.next_decision_cost_sar),
        expected_information_gain_points: Number(
          body.expected_information_gain_points,
        ),
        rationale: body.rationale ?? "",
      },
      idempotencyKey.trim(),
      correlationId || "CORR-" + randomUUID(),
    );
  }

  @Get("assets/:assetId/assessments")
  assessmentHistory(
    @Param("assetId") assetId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.assessments.history(assetId, actor);
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
