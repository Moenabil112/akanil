import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { assertRuntimeConfiguration } from "./runtime/runtime-config";

function allowedOrigins(): string[] {
  return (process.env.QASSAS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function bootstrap(): Promise<void> {
  assertRuntimeConfiguration();

  const app = await NestFactory.create(AppModule);
  const origins = allowedOrigins();

  if (origins.length > 0) {
    app.enableCors({
      origin: origins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Authorization",
        "Content-Type",
        "X-Qassas-Correlation-Id",
        "X-Qassas-Idempotency-Key",
      ],
      exposedHeaders: ["X-Correlation-Id"],
      credentials: false,
      maxAge: 600,
    });
  }

  app.setGlobalPrefix("api/v1");
  await app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0");
}

void bootstrap();
