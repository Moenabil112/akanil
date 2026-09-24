import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { VerifiedKeycloakIdentity } from "./auth.types";

export const CurrentIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): VerifiedKeycloakIdentity => {
    const request = context.switchToHttp().getRequest<{
      qassasIdentity: VerifiedKeycloakIdentity;
    }>();
    return request.qassasIdentity;
  },
);
