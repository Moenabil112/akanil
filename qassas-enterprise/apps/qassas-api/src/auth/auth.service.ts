import { Injectable, UnauthorizedException } from "@nestjs/common";
import { KeycloakJwtService } from "./keycloak-jwt.service";
import { RoleAssignmentRepository } from "./role-assignment.repository";
import type { AuthenticatedActor } from "./auth.types";

@Injectable()
export class AuthService {
  constructor(
    private readonly keycloak: KeycloakJwtService,
    private readonly roles: RoleAssignmentRepository,
  ) {}

  async authenticate(authorization?: string): Promise<AuthenticatedActor> {
    const claims = await this.keycloak.verifyAuthorizationHeader(authorization);
    const externalSubject =
      typeof claims.sub === "string" ? claims.sub : undefined;

    if (!externalSubject) {
      throw new UnauthorizedException("Token subject is missing");
    }

    const actor = await this.roles.findActiveActorBySubject(externalSubject);
    if (!actor) {
      throw new UnauthorizedException("QASSAS user is not active");
    }

    return {
      userId: actor.userId,
      externalSubject,
      roleAssignments: actor.roleAssignments,
      claims,
    };
  }
}
