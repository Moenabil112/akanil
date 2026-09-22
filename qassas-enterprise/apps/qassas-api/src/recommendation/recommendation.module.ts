import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { RecommendationController } from "./recommendation.controller";
import { RecommendationService } from "./recommendation.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [RecommendationController],
  providers: [RecommendationService],
})
export class RecommendationModule {}
