import type { JWTPayload } from "jose";

export interface RoleAssignment {
  roleAssignmentId: string;
  roleType: string;
  assetScope: string[];
  jvScope: string[];
  decisionClassScope: string[];
  capitalThreshold: string | null;
  securityClearance: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
}

export interface AuthenticatedActor {
  userId: string;
  externalSubject: string;
  roleAssignments: RoleAssignment[];
  claims: JWTPayload;
}
