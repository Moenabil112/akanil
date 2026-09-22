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
import { EvidenceService } from "./evidence.service";
import type {
  CreateEvidenceSnapshotCommand,
  OpenDataGapCommand,
  OpenEvidenceConflictCommand,
  QualifyEvidenceCommand,
  RegisterEvidenceCommand,
} from "./evidence.types";

@Controller("evidence")
@UseGuards(KeycloakAuthGuard)
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Post()
  register(
    @Body() body: RegisterEvidenceCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.evidence.registerEvidence(
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Get(":id")
  getEvidence(
    @Param("id") evidenceId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.evidence.getEvidence(evidenceId, actor);
  }

  @Post(":id/qualifications")
  qualify(
    @Param("id") evidenceId: string,
    @Body() body: QualifyEvidenceCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("if-match") ifMatch?: string,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.evidence.qualifyEvidence(
      evidenceId,
      actor,
      body,
      this.expectedVersion(ifMatch),
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post("snapshots")
  createSnapshot(
    @Body() body: CreateEvidenceSnapshotCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.evidence.createSnapshot(
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Get("snapshots/:id")
  getSnapshot(
    @Param("id") snapshotId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.evidence.getSnapshot(snapshotId, actor);
  }

  @Post("data-gaps")
  openGap(
    @Body() body: OpenDataGapCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.evidence.openDataGap(
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post("conflicts")
  openConflict(
    @Body() body: OpenEvidenceConflictCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.evidence.openConflict(
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
