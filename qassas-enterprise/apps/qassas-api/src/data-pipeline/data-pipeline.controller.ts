import {
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
import { DataPipelineService } from "./data-pipeline.service";

@Controller("data-pipeline")
@UseGuards(KeycloakAuthGuard)
export class DataPipelineController {
  constructor(private readonly pipeline: DataPipelineService) {}

  @Get("portfolios/:portfolioId/status")
  portfolioStatus(
    @Param("portfolioId") portfolioId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.pipeline.portfolioStatus(portfolioId, actor);
  }

  @Get("portfolios/:portfolioId/assets")
  listAssets(
    @Param("portfolioId") portfolioId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.pipeline.listAssets(portfolioId, actor);
  }

  @Post("runs")
  startRun(
    @Body()
    body: {
      portfolio_id?: string;
      source_id?: string;
      trigger_type?: "SCHEDULED" | "MANUAL" | "SOURCE_CHANGE" | "PARTNER_DELIVERY";
      source_snapshot_ref?: string | null;
    },
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.pipeline.startRun(
      actor,
      body,
      correlationId?.trim() || `CORR-${Date.now()}`,
    );
  }

  @Post("runs/:runId/records")
  appendRecords(
    @Param("runId") runId: string,
    @Body() body: { records?: unknown[] },
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.pipeline.appendRecords(
      actor,
      runId,
      (body.records ?? []) as Parameters<DataPipelineService["appendRecords"]>[2],
    );
  }

  @Post("runs/:runId/complete")
  completeRun(
    @Param("runId") runId: string,
    @Body() body: { content_manifest_hash?: string | null },
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.pipeline.completeRun(
      actor,
      runId,
      body.content_manifest_hash ?? null,
    );
  }

  @Post("assets/discover")
  discoverAsset(
    @Body() body: Parameters<DataPipelineService["discoverAsset"]>[1],
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.pipeline.discoverAsset(actor, body);
  }
}
