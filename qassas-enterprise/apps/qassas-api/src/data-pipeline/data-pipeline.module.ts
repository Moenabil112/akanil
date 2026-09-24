import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { DataPipelineController } from "./data-pipeline.controller";
import { DataPipelineService } from "./data-pipeline.service";

@Module({
  imports: [DatabaseModule],
  controllers: [DataPipelineController],
  providers: [DataPipelineService],
  exports: [DataPipelineService],
})
export class DataPipelineModule {}
