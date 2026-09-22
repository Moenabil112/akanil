import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { ConstraintAssessmentController } from "./constraint-assessment.controller";
import { ConstraintAssessmentService } from "./constraint-assessment.service";
import { RightsController } from "./rights.controller";
import { RightsRegistryService } from "./rights-registry.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [RightsController, ConstraintAssessmentController],
  providers: [RightsRegistryService, ConstraintAssessmentService],
})
export class RightsModule {}
