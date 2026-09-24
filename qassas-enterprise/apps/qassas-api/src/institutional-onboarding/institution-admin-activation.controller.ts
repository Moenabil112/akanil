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
import { InstitutionAdminActivationService } from "./institution-admin-activation.service";

@Controller("institutional-onboarding")
@UseGuards(KeycloakAuthGuard)
export class InstitutionAdminActivationController {
  constructor(
    private readonly activation: InstitutionAdminActivationService,
  ) {}

  @Post("institutions/:institutionId/admin-activation-tickets")
  createTicket(
    @Param("institutionId") institutionId: string,
    @Body()
    body: {
      expected_email?: string;
      expires_in_hours?: number;
    },
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.activation.createTicket(
      actor,
      institutionId,
      body,
      correlationId?.trim() || `CORR-${Date.now()}`,
    );
  }

  @Get("institutions/:institutionId/admin-activation-tickets/latest")
  latestTicket(
    @Param("institutionId") institutionId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.activation.latestTicket(actor, institutionId);
  }
}
