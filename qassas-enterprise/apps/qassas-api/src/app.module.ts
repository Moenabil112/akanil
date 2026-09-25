import { Module } from "@nestjs/common";
import { AuditModule } from "./audit/audit.module";
import { CapitalModule } from "./capital/capital.module";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { DataPipelineModule } from "./data-pipeline/data-pipeline.module";
import { DecisionModule } from "./decision/decision.module";
import { InstitutionOnboardingModule } from "./institutional-onboarding/institution-onboarding.module";
import { EvidenceModule } from "./evidence/evidence.module";
import { HealthController } from "./health/health.controller";
import { InstitutionalPortfolioModule } from "./institutional-portfolio/institutional-portfolio.module";
import { OutboxModule } from "./outbox/outbox.module";
import { MultiAssetModule } from "./multi-asset/multi-asset.module";
import { ObservabilityModule } from "./observability/observability.module";
import { PortfolioControlModule } from "./portfolio-control/portfolio-control.module";
import { PortfolioIntelligenceModule } from "./portfolio-intelligence/portfolio-intelligence.module";
import { TaadeenAdapterModule } from "./public-sources/taadeen/taadeen-adapter.module";
import { RecommendationModule } from "./recommendation/recommendation.module";
import { RightsModule } from "./rights/rights.module";
import { TargetModule } from "./target/target.module";
import { TemporalModule } from "./temporal/temporal.module";

@Module({
  imports: [
    DatabaseModule,
    TemporalModule,
    OutboxModule,
    AuthModule,
    AuditModule,
    CapitalModule,
    DataPipelineModule,
    TargetModule,
    EvidenceModule,
    InstitutionOnboardingModule,
    InstitutionalPortfolioModule,
    RecommendationModule,
    RightsModule,
    PortfolioControlModule,
    PortfolioIntelligenceModule,
    TaadeenAdapterModule,
    MultiAssetModule,
    ObservabilityModule,
    DecisionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
