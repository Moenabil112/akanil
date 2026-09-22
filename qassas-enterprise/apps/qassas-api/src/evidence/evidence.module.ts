import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { EvidenceController } from "./evidence.controller";
import { EvidenceService } from "./evidence.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [EvidenceController],
  providers: [EvidenceService],
  exports: [EvidenceService],
})
export class EvidenceModule {}
