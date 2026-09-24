import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { CurrentActor } from "../auth/current-actor.decorator";
import { KeycloakAuthGuard } from "../auth/keycloak-auth.guard";
import type { AuthenticatedActor } from "../auth/auth.types";
import { InstitutionalPortfolioService } from "./institutional-portfolio.service";

@Controller("institutional-portfolios")
@UseGuards(KeycloakAuthGuard)
export class InstitutionalPortfolioController {
  constructor(private readonly portfolios: InstitutionalPortfolioService) {}

  @Get()
  list(@CurrentActor() actor: AuthenticatedActor) {
    return this.portfolios.list(actor);
  }

  @Get(":portfolioId")
  get(
    @Param("portfolioId") portfolioId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.portfolios.get(portfolioId, actor);
  }

  @Get(":portfolioId/data-sources")
  dataSources(
    @Param("portfolioId") portfolioId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.portfolios.dataSources(portfolioId, actor);
  }
}
