import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { CapitalController } from "./capital.controller";
import { CapitalService } from "./capital.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [CapitalController],
  providers: [CapitalService],
  exports: [CapitalService],
})
export class CapitalModule {}
