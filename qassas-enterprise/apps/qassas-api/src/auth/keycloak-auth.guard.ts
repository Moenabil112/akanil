import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import type { AuthenticatedActor } from "./auth.types";

interface QassasRequest {
  headers: { authorization?: string | string[] };
  qassasActor?: AuthenticatedActor;
}

@Injectable()
export class KeycloakAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<QassasRequest>();
    const raw = request.headers.authorization;
    const authorization = Array.isArray(raw) ? raw[0] : raw;
    request.qassasActor = await this.auth.authenticate(authorization);
    return true;
  }
}
