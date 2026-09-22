import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { CurrentActor } from "../auth/current-actor.decorator";
import { KeycloakAuthGuard } from "../auth/keycloak-auth.guard";
import type { AuthenticatedActor } from "../auth/auth.types";
import { MultiAssetService } from "./multi-asset.service";

@Controller()
@UseGuards(KeycloakAuthGuard)
export class MultiAssetController {
  constructor(private readonly multiAsset: MultiAssetService) {}

  @Get("pilot-assets")
  listAssets(@CurrentActor() actor: AuthenticatedActor) {
    return this.multiAsset.listAssets(actor);
  }

  @Get("pilot-assets/:assetId")
  getAsset(
    @Param("assetId") assetId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.multiAsset.getAsset(assetId, actor);
  }

  @Get("pilot-workflow-templates")
  listWorkflowTemplates(@CurrentActor() actor: AuthenticatedActor) {
    return this.multiAsset.listWorkflowTemplates(actor);
  }

  @Get("pilot-decision-queue")
  decisionQueue(@CurrentActor() actor: AuthenticatedActor) {
    return this.multiAsset.decisionQueue(actor);
  }
}
