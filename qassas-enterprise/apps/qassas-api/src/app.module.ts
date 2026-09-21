import { Module } from "@nestjs/common";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { DecisionModule } from "./decision/decision.module";
import { HealthController } from "./health/health.controller";
import { TargetModule } from "./target/target.module";

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AuditModule,
    TargetModule,
    DecisionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
