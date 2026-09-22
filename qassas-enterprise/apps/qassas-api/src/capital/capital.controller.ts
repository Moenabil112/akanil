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
import { CapitalService } from "./capital.service";
import type {
  CapitalApprovalCommand,
  CapitalReleaseCommand,
  CapitalReturnCommand,
  CreateCapitalRequestCommand,
} from "./capital.types";

@Controller("capital")
@UseGuards(KeycloakAuthGuard)
export class CapitalController {
  constructor(private readonly capital: CapitalService) {}

  @Post("requests")
  create(
    @Body() body: CreateCapitalRequestCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.capital.createRequest(
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Get("requests/:id")
  get(
    @Param("id") requestId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.capital.getRequest(requestId, actor);
  }

  @Post("requests/:id/assess")
  assess(
    @Param("id") requestId: string,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("if-match") ifMatch?: string,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.capital.assess(
      requestId,
      actor,
      this.expectedVersion(ifMatch),
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post("requests/:id/approve")
  approve(
    @Param("id") requestId: string,
    @Body() body: CapitalApprovalCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("if-match") ifMatch?: string,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.capital.approve(
      requestId,
      actor,
      body,
      this.expectedVersion(ifMatch),
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post("requests/:id/release")
  release(
    @Param("id") requestId: string,
    @Body() body: CapitalReleaseCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("if-match") ifMatch?: string,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.capital.release(
      requestId,
      actor,
      body,
      this.expectedVersion(ifMatch),
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  @Post("requests/:id/return")
  returnCapital(
    @Param("id") requestId: string,
    @Body() body: CapitalReturnCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("if-match") ifMatch?: string,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.capital.returnCapital(
      requestId,
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
