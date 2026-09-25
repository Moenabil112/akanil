import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentActor } from "../../auth/current-actor.decorator";
import { KeycloakAuthGuard } from "../../auth/keycloak-auth.guard";
import type { AuthenticatedActor } from "../../auth/auth.types";
import { TaadeenAdapterService } from "./taadeen-adapter.service";

@Controller("public-sources/taadeen")
@UseGuards(KeycloakAuthGuard)
export class TaadeenAdapterController {
  constructor(private readonly taadeen: TaadeenAdapterService) {}

  @Get("portfolios/:portfolioId/status")
  status(
    @Param("portfolioId") portfolioId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.taadeen.status(portfolioId, actor);
  }

  @Post("portfolios/:portfolioId/sync")
  sync(
    @Param("portfolioId") portfolioId: string,
    @Body() body: { license_numbers?: string[]; max_records?: number },
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.taadeen.syncPortfolio(
      actor,
      portfolioId,
      body,
      correlationId?.trim() || "CORR-TAADEN-" + Date.now(),
    );
  }
}
