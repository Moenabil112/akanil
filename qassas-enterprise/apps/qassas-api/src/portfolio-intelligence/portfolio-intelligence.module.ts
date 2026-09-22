import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PortfolioAssessmentService } from "./portfolio-assessment.service";
import { PortfolioChangeService } from "./portfolio-change.service";
import { PortfolioIntelligenceController } from "./portfolio-intelligence.controller";
import { PortfolioIntelligenceService } from "./portfolio-intelligence.service";
import { PortfolioReassessmentService } from "./portfolio-reassessment.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [PortfolioIntelligenceController],
  providers: [
    PortfolioIntelligenceService,
    PortfolioAssessmentService,
    PortfolioChangeService,
    PortfolioReassessmentService,
  ],
})
export class PortfolioIntelligenceModule {}
