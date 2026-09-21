import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedActor } from "./auth.types";

interface QassasRequest {
  qassasActor?: AuthenticatedActor;
}

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedActor => {
    const request = context.switchToHttp().getRequest<QassasRequest>();
    if (!request.qassasActor) {
      throw new Error("Authenticated actor is unavailable");
    }
    return request.qassasActor;
  },
);
