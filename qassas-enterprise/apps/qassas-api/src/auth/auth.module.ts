import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { KeycloakAuthGuard } from "./keycloak-auth.guard";
import { KeycloakJwtService } from "./keycloak-jwt.service";
import { OpaPolicyService } from "./opa-policy.service";
import { RoleAssignmentRepository } from "./role-assignment.repository";

@Module({
  providers: [
    AuthService,
    KeycloakJwtService,
    RoleAssignmentRepository,
    KeycloakAuthGuard,
    OpaPolicyService,
  ],
  exports: [KeycloakAuthGuard, OpaPolicyService],
})
export class AuthModule {}
