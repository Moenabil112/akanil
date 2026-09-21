import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditController } from "./audit.controller";
import { AuditEventWriter } from "./audit-event.writer";
import { AuditQueryService } from "./audit-query.service";

@Module({
  imports: [AuthModule],
  controllers: [AuditController],
  providers: [AuditEventWriter, AuditQueryService],
  exports: [AuditEventWriter],
})
export class AuditModule {}
