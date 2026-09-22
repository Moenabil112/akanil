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
import { RecommendationReviewService } from "./recommendation-review.service";
import type { ReviewRecommendationCommand } from "./recommendation-review.types";

@Controller("decisions")
@UseGuards(KeycloakAuthGuard)
export class RecommendationReviewController {
  constructor(private readonly reviews: RecommendationReviewService) {}

  @Get(":id/recommendations/:recommendationId/review")
  getReview(
    @Param("id") decisionId: string,
    @Param("recommendationId") recommendationId: string,
    @CurrentActor() actor: AuthenticatedActor,
  ) {
    return this.reviews.getReview(decisionId, recommendationId, actor);
  }

  @Post(":id/recommendations/:recommendationId/review")
  review(
    @Param("id") decisionId: string,
    @Param("recommendationId") recommendationId: string,
    @Body() body: ReviewRecommendationCommand,
    @CurrentActor() actor: AuthenticatedActor,
    @Headers("x-qassas-idempotency-key") idempotencyKey?: string,
    @Headers("x-qassas-correlation-id") correlationId?: string,
  ) {
    return this.reviews.reviewRecommendation(
      decisionId,
      recommendationId,
      actor,
      body,
      this.requireIdempotency(idempotencyKey),
      correlationId || `CORR-${randomUUID()}`,
    );
  }

  private requireIdempotency(value?: string) {
    if (!value?.trim()) {
      throw new BadRequestException(
        "X-Qassas-Idempotency-Key is required",
      );
    }
    return value.trim();
  }
}
