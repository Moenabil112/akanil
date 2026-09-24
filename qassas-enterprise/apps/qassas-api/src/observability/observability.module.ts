import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { CorrelationLoggingMiddleware } from "./correlation-logging.middleware";
import { ObservabilityController } from "./observability.controller";
import { OperationalMetricsService } from "./operational-metrics.service";

@Module({
  controllers: [ObservabilityController],
  providers: [OperationalMetricsService, CorrelationLoggingMiddleware],
  exports: [OperationalMetricsService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationLoggingMiddleware)
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
