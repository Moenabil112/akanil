import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { DatabaseModule } from "../database/database.module";
import { InstitutionAdminActivationClaimController } from "./institution-admin-activation-claim.controller";
import { InstitutionAdminActivationController } from "./institution-admin-activation.controller";
import { InstitutionAdminActivationService } from "./institution-admin-activation.service";
import { InstitutionOnboardingController } from "./institution-onboarding.controller";
import { InstitutionOnboardingService } from "./institution-onboarding.service";

@Module({
  imports: [DatabaseModule, AuthModule, AuditModule],
  controllers: [
    InstitutionOnboardingController,
    InstitutionAdminActivationController,
    InstitutionAdminActivationClaimController,
  ],
  providers: [
    InstitutionOnboardingService,
    InstitutionAdminActivationService,
  ],
  exports: [
    InstitutionOnboardingService,
    InstitutionAdminActivationService,
  ],
})
export class InstitutionOnboardingModule {}
