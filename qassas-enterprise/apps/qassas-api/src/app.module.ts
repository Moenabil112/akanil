import { Module } from "@nestjs/common";
import { AuditModule } from "./audit/audit.module";
import { CapitalModule } from "./capital/capital.module";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { DecisionModule } from "./decision/decision.module";
import { EvidenceModule } from "./evidence/evidence.module";
import { HealthController } from "./health/health.controller";
import { OutboxModule } from "./outbox/outbox.module";
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
    TargetModule,
    EvidenceModule,
    RecommendationModule,
    RightsModule,
    DecisionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
