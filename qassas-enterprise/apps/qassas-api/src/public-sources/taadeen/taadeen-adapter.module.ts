import { Module } from "@nestjs/common";
import { AuthModule } from "../../auth/auth.module";
import { DatabaseModule } from "../../database/database.module";
import { TaadeenAdapterController } from "./taadeen-adapter.controller";
import { TaadeenAdapterService } from "./taadeen-adapter.service";

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TaadeenAdapterController],
  providers: [TaadeenAdapterService],
  exports: [TaadeenAdapterService],
})
export class TaadeenAdapterModule {}
