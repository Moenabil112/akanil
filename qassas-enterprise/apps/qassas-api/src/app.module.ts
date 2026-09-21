import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { TargetModule } from "./target/target.module";

@Module({
  imports: [DatabaseModule, AuthModule, TargetModule],
  controllers: [HealthController],
})
export class AppModule {}
