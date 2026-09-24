import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { DataPipelineController } from "./data-pipeline.controller";
import { DataPipelineService } from "./data-pipeline.service";

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DataPipelineController],
  providers: [DataPipelineService],
  exports: [DataPipelineService],
})
export class DataPipelineModule {}
