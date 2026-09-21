import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { DecisionController } from "./decision.controller";
import { DecisionService } from "./decision.service";

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [DecisionController],
  providers: [DecisionService],
})
export class DecisionModule {}
