import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { TargetController } from "./target.controller";
import { TargetRepository } from "./target.repository";

@Module({
  imports: [AuthModule],
  controllers: [TargetController],
  providers: [TargetRepository],
})
export class TargetModule {}
