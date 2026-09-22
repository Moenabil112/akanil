import { Module } from "@nestjs/common";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { DecisionModule } from "./decision/decision.module";
import { EvidenceModule } from "./evidence/evidence.module";
import { HealthController } from "./health/health.controller";
import { OutboxModule } from "./outbox/outbox.module";
import { RecommendationModule } from "./recommendation/recommendation.module";
import { TargetModule } from "./target/target.module";
import { TemporalModule } from "./temporal/temporal.module";

@Module({
  imports: [
    DatabaseModule,
    TemporalModule,
    OutboxModule,
    AuthModule,
    AuditModule,
    TargetModule,
    EvidenceModule,
    RecommendationModule,
    DecisionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
