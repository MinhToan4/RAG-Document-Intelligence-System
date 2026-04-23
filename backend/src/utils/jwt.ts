import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { AuthClaims, JwtTokenType, UserRecord } from '../types/index.js';

type VerifyResult = AuthClaims & JwtPayload;

function buildClaims(user: UserRecord, tokenType: JwtTokenType): AuthClaims {
  return {
    sub: user.username,
    userId: user.id,
    email: user.email,
    scope: user.role,
    tokenType,
  };
}

function signToken(user: UserRecord, tokenType: JwtTokenType, expiresInSeconds: number): string {
  const payload = buildClaims(user, tokenType);
  const options: SignOptions = {
    algorithm: 'HS512',
    issuer: env.JWT_ISSUER,
    expiresIn: expiresInSeconds,
  };
  return jwt.sign(payload, env.JWT_SIGN_KEY, options);
}

export function generateAccessToken(user: UserRecord): string {
  return signToken(user, 'ACCESS', env.JWT_ACCESS_TOKEN_DURATION);
}

export function generateRefreshToken(user: UserRecord): string {
  return signToken(user, 'REFRESH', env.JWT_REFRESH_TOKEN_DURATION);
}

export function verifyToken(token: string): VerifyResult {
  return jwt.verify(token, env.JWT_SIGN_KEY, {
    algorithms: ['HS512'],
    issuer: env.JWT_ISSUER,
  }) as VerifyResult;
}

export function verifyTokenType(token: string, tokenType: JwtTokenType): VerifyResult {
  const claims = verifyToken(token);
  if (claims.tokenType !== tokenType) {
    throw new Error(`Invalid token type. Expected ${tokenType}`);
  }
  return claims;
}
