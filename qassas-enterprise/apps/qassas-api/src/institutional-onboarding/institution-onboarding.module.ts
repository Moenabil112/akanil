import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { InstitutionOnboardingController } from "./institution-onboarding.controller";
import { InstitutionOnboardingService } from "./institution-onboarding.service";

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule],
  controllers: [InstitutionOnboardingController],
  providers: [InstitutionOnboardingService],
  exports: [InstitutionOnboardingService],
})
export class InstitutionOnboardingModule {}
