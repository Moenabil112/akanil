import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { RecommendationController } from "./recommendation.controller";
import { RecommendationReviewController } from "./recommendation-review.controller";
import { RecommendationReviewService } from "./recommendation-review.service";
import { RecommendationService } from "./recommendation.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    RecommendationController,
    RecommendationReviewController,
  ],
  providers: [
    RecommendationService,
    RecommendationReviewService,
  ],
})
export class RecommendationModule {}
