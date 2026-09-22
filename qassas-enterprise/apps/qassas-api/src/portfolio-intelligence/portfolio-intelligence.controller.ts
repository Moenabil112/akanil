import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { CurrentActor } from "../auth/current-actor.decorator";
import { KeycloakAuthGuard } from "../auth/keycloak-auth.guard";
import type { AuthenticatedActor } from "../auth/auth.types";
import { PortfolioIntelligenceService } from "./portfolio-intelligence.service";

@Controller("portfolio-intelligence")
@UseGuards(KeycloakAuthGuard)
export class PortfolioIntelligenceController {
  constructor(private readonly intelligence: PortfolioIntelligenceService) {}

  @Get("priority-queue")
  priorityQueue(@CurrentActor() actor: AuthenticatedActor) {
    return this.intelligence.priorityQueue(actor);
  }

  @Get("control-board")
  controlBoard(@CurrentActor() actor: AuthenticatedActor) {
    return this.intelligence.controlBoard(actor);
  }

  @Get("assets/:assetId")
  getAsset(@Param("assetId") assetId: string, @CurrentActor() actor: AuthenticatedActor) {
    return this.intelligence.getAsset(assetId, actor);
  }
}
