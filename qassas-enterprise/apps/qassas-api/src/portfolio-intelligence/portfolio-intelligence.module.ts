import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PortfolioIntelligenceController } from "./portfolio-intelligence.controller";
import { PortfolioIntelligenceService } from "./portfolio-intelligence.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [PortfolioIntelligenceController],
  providers: [PortfolioIntelligenceService],
})
export class PortfolioIntelligenceModule {}
