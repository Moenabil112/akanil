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
import { InstitutionOnboardingService } from "./institution-onboarding.service";

@Controller("institutional-onboarding")
@UseGuards(KeycloakAuthGuard)
export class InstitutionOnboardingController {
  constructor(private readonly onboarding: InstitutionOnboardingService) {}

  @Get("institutions/:institutionId/status")
  status(
    @Param("institutionId") institutionId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.onboarding.status(institutionId, actor);
  }

  @Get("institutions/:institutionId/agreements")
  listAgreements(
    @Param("institutionId") institutionId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.onboarding.listAgreements(institutionId, actor);
  }

  @Post("agreements")
  recordAgreement(
    @Body()
    body: {
      institution_id?: string;
      agreement_id?: string;
      agreement_type?: "TERM_SHEET" | "DATA_SHARING_AGREEMENT" | "NDA" | "PILOT_AGREEMENT";
      agreement_status?: "DRAFT" | "SIGNED" | "ACTIVE" | "EXPIRED" | "TERMINATED";
      document_ref?: string;
      document_hash?: string;
      allowed_domains?: string[];
      effective_from?: string | null;
      effective_to?: string | null;
    },
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.onboarding.recordAgreement(
      actor,
      body,
      correlationId?.trim() || `CORR-${Date.now()}`,
    );
  }

  @Post("portfolios/:portfolioId/sources/:sourceId/activate")
  activatePrivateSource(
    @Param("portfolioId") portfolioId: string,
    @Param("sourceId") sourceId: string,
    @Body() body: { agreement_id?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.onboarding.activatePrivateSource(
      actor,
      portfolioId,
      sourceId,
      body,
      correlationId?.trim() || `CORR-${Date.now()}`,
    );
  }

  @Post("institutions/:institutionId/primary-admin/bind")
  bindPrimaryAdmin(
    @Param("institutionId") institutionId: string,
    @Body() body: { external_subject?: string },
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.onboarding.bindPrimaryAdmin(
      actor,
      institutionId,
      body,
      correlationId?.trim() || `CORR-${Date.now()}`,
    );
  }
}
