import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { VisitPrincipal } from '../visits/domain/visit.repository.js';
import { uuidPattern } from './http-contract.js';
import { VisitProblem } from './visit-problem.js';

export type AuthenticatedRequest = Request & { principal: VisitPrincipal };
export const VisitRoles = Reflector.createDecorator<readonly string[]>();

@Injectable()
export class IdentityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  private readonly keys = process.env.JWT_JWKS_URL
    ? createRemoteJWKSet(new URL(process.env.JWT_JWKS_URL), {
        timeoutDuration: 2000,
      })
    : undefined;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = /^Bearer (\S+)$/i.exec(
      request.header('Authorization') ?? '',
    )?.[1];
    if (!token || !this.keys) throw new VisitProblem('AUTH_INVALID_TOKEN');

    try {
      const keys = this.keys;
      const { payload } = await jwtVerify(
        token,
        (header, signedToken) => {
          if (typeof header.kid !== 'string' || !header.kid) {
            throw new VisitProblem('AUTH_INVALID_TOKEN');
          }
          return keys(header, signedToken);
        },
        {
          algorithms: ['RS256'],
          issuer: 'identity-service',
          audience: 'inmobiliaria',
          typ: 'at+jwt',
          requiredClaims: ['sub', 'exp', 'roles'],
        },
      );
      if (
        typeof payload.sub !== 'string' ||
        !uuidPattern.test(payload.sub) ||
        !Array.isArray(payload.roles) ||
        !payload.roles.every((role: unknown) => typeof role === 'string')
      ) {
        throw new VisitProblem('AUTH_INVALID_TOKEN');
      }
      request.principal = {
        id: payload.sub.toLowerCase(),
        roles: payload.roles,
      };
    } catch {
      throw new VisitProblem('AUTH_INVALID_TOKEN');
    }
    const roles = this.reflector.get(VisitRoles, context.getHandler());
    if (!roles.some((role) => request.principal.roles.includes(role))) {
      throw new VisitProblem('PERMISSION_DENIED');
    }
    return true;
  }
}
