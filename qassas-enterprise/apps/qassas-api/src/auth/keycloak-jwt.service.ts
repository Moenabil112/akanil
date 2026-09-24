import { Injectable, UnauthorizedException } from "@nestjs/common";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type RemoteJWKSet,
} from "jose";

@Injectable()
export class KeycloakJwtService {
  private jwks?: RemoteJWKSet;

  private issuer(): string {
    const issuer = process.env.KEYCLOAK_ISSUER;
    if (!issuer) {
      throw new UnauthorizedException("Identity issuer is not configured");
    }
    return issuer.replace(/\/$/, "");
  }

  private keySet(): RemoteJWKSet {
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(
        new URL(`${this.issuer()}/protocol/openid-connect/certs`),
      );
    }
    return this.jwks;
  }

  async health(): Promise<boolean> {
    try {
      const issuer = this.issuer();
      const response = await fetch(
        `${issuer}/.well-known/openid-configuration`,
        { signal: AbortSignal.timeout(3000) },
      );
      if (!response.ok) return false;

      const document = (await response.json()) as {
        issuer?: string;
        jwks_uri?: string;
      };

      return document.issuer === issuer && typeof document.jwks_uri === "string";
    } catch {
      return false;
    }
  }

  async verifyAuthorizationHeader(
    authorization?: string,
  ): Promise<JWTPayload> {
    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Bearer token is required");
    }

    const token = authorization.slice("Bearer ".length).trim();
    const { payload } = await jwtVerify(token, this.keySet(), {
      issuer: this.issuer(),
    });

    const expectedClient = process.env.KEYCLOAK_API_CLIENT_ID;
    if (expectedClient) {
      const audience = Array.isArray(payload.aud)
        ? payload.aud
        : payload.aud
          ? [payload.aud]
          : [];
      const authorisedParty =
        typeof payload.azp === "string" ? payload.azp : undefined;

      if (
        authorisedParty !== expectedClient &&
        !audience.includes(expectedClient)
      ) {
        throw new UnauthorizedException("Token is not issued for QASSAS API");
      }
    }

    return payload;
  }
}
