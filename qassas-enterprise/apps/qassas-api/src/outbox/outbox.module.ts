import { Global, Module } from "@nestjs/common";
import { DecisionReadModelConsumer } from "./decision-read-model.consumer";
import { OutboxPublisherService } from "./outbox-publisher.service";

@Global()
@Module({
  providers: [DecisionReadModelConsumer, OutboxPublisherService],
  exports: [OutboxPublisherService],
})
export class OutboxModule {}
