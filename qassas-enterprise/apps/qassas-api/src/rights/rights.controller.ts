import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentActor } from "../auth/current-actor.decorator";
import { KeycloakAuthGuard } from "../auth/keycloak-auth.guard";
import type { AuthenticatedActor } from "../auth/auth.types";
import { RightsRegistryService } from "./rights-registry.service";
import type {
  AddLicencePartyRoleCommand,
  CreateWorkCommitmentCommand,
  DefineJVConstraintCommand,
  RecordJVConsentCommand,
  RegisterLicenceCommand,
  UpdateWorkCommitmentCommand,
} from "./rights.types";

@Controller("rights")
@UseGuards(KeycloakAuthGuard)
export class RightsController {
  constructor(private readonly rights: RightsRegistryService) {}

  @Post("licences")
  registerLicence(
    @Body() body: RegisterLicenceCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.rights.registerLicence(
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Get("licences/:id")
  getLicence(
    @Param("id") licenceId: string,
    @Query("jv_id") jvId: string | undefined,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.rights.getLicence(licenceId, actor, jvId ?? null);
  }

  @Post("licences/:id/party-roles")
  addPartyRole(
    @Param("id") licenceId: string,
    @Body() body: AddLicencePartyRoleCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.rights.addPartyRole(
      licenceId,
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post("licences/:id/jv-constraints")
  defineJVConstraint(
    @Param("id") licenceId: string,
    @Body() body: DefineJVConstraintCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.rights.defineJVConstraint(
      licenceId,
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post("jv-constraints/:id/consents")
  recordConsent(
    @Param("id") constraintId: string,
    @Body() body: RecordJVConsentCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.rights.recordConsent(
      constraintId,
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post("licences/:id/work-commitments")
  createWorkCommitment(
    @Param("id") licenceId: string,
    @Body() body: CreateWorkCommitmentCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.rights.createWorkCommitment(
      licenceId,
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post("work-commitments/:id/status")
  updateWorkCommitment(
    @Param("id") commitmentId: string,
    @Body() body: UpdateWorkCommitmentCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("if-match") ifMatch?: string,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.rights.updateWorkCommitment(
      commitmentId,
      actor,
      body,
      this.expectedVersion(ifMatch),
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
