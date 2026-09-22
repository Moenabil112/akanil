import {
  Controller,
  Get,
  Param,
  UseGuards,
} from "@nestjs/common";
import { CurrentActor } from "../auth/current-actor.decorator";
import { KeycloakAuthGuard } from "../auth/keycloak-auth.guard";
import type { AuthenticatedActor } from "../auth/auth.types";
import { PortfolioControlService } from "./portfolio-control.service";

@Controller("portfolio-control")
@UseGuards(KeycloakAuthGuard)
export class PortfolioControlController {
  constructor(private readonly control: PortfolioControlService) {}

  @Get("decisions/:id")
  getDecision(
    @Param("id") decisionId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.control.getDecision(decisionId, actor);
  }

  @Get("assets/:assetId")
  listAsset(
    @Param("assetId") assetId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.control.listAsset(assetId, actor);
  }
}
