import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { KeycloakJwtService } from "./keycloak-jwt.service";
import type { VerifiedKeycloakIdentity } from "./auth.types";

interface QassasIdentityRequest {
  headers: { authorization?: string | string[] };
  qassasIdentity?: VerifiedKeycloakIdentity;
}

@Injectable()
export class KeycloakIdentityGuard implements CanActivate {
  constructor(private readonly keycloak: KeycloakJwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<QassasIdentityRequest>();
    const raw = request.headers.authorization;
    const authorization = Array.isArray(raw) ? raw[0] : raw;
    const claims = await this.keycloak.verifyAuthorizationHeader(authorization);

    const externalSubject =
      typeof claims.sub === "string" ? claims.sub.trim() : "";
    if (!externalSubject) {
      throw new UnauthorizedException("Token subject is missing");
    }

    const email =
      typeof claims.email === "string" ? claims.email.trim().toLowerCase() : null;

    request.qassasIdentity = {
      externalSubject,
      email,
      emailVerified: claims.email_verified === true,
      claims,
    };
    return true;
  }
}
