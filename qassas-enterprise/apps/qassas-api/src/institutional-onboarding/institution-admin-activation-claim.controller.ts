import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import { KeycloakIdentityGuard } from "../auth/keycloak-identity.guard";
import type { VerifiedKeycloakIdentity } from "../auth/auth.types";
import { InstitutionAdminActivationService } from "./institution-admin-activation.service";

@Controller("institutional-onboarding")
export class InstitutionAdminActivationClaimController {
  constructor(
    private readonly activation: InstitutionAdminActivationService,
  ) {}

  @Post("admin-activation-tickets/:ticketId/claim")
  @UseGuards(KeycloakIdentityGuard)
  claim(
    @Param("ticketId") ticketId: string,
    @Body() body: { activation_code?: string },
    @CurrentIdentity() identity: VerifiedKeycloakIdentity,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.activation.claimTicket(
      identity,
      ticketId,
      body.activation_code,
      correlationId?.trim() || `CORR-${Date.now()}`,
    );
  }
}
