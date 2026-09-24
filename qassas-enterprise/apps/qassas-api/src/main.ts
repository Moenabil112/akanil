import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { assertRuntimeConfiguration } from "./runtime/runtime-config";

async function bootstrap(): Promise<void> {
  assertRuntimeConfiguration();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  await app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0");
}

void bootstrap();
