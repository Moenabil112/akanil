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

  @Get("pilot-operations/exploration")
  explorationDirectorQueue(@CurrentActor() actor: AuthenticatedActor) {
    return this.multiAsset.explorationDirectorQueue(actor);
  }

  @Get("pilot-operations/finance")
  financeQueue(@CurrentActor() actor: AuthenticatedActor) {
    return this.multiAsset.financeQueue(actor);
  }

  @Get("pilot-operations/jv")
  jvReviewQueue(@CurrentActor() actor: AuthenticatedActor) {
    return this.multiAsset.jvReviewQueue(actor);
  }

  @Get("pilot-decision-queue")
  decisionQueue(@CurrentActor() actor: AuthenticatedActor) {
    return this.multiAsset.decisionQueue(actor);
  }
}
