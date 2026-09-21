import { Global, Module } from "@nestjs/common";
import { TemporalWorkflowService } from "./temporal-workflow.service";

@Global()
@Module({
  providers: [TemporalWorkflowService],
  exports: [TemporalWorkflowService],
})
export class TemporalModule {}
