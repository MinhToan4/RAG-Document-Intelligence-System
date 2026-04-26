/**
 * Express middleware for auth concerns in the API request/response pipeline.
 */
import type { RequestHandler } from 'express';
import { verifyTokenType } from '../utils/jwt.js';

function extractBearerToken(authorization?: string): string | null {
  if (!authorization) {
    return null;
  }
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token.trim();
}

export const authMiddleware: RequestHandler = (req, res, next) => {
  const token = extractBearerToken(req.header('authorization'));
  if (!token) {
    res.status(401).json({ message: 'Unauthorized: missing bearer token' });
    return;
  }

  try {
    const claims = verifyTokenType(token, 'ACCESS');
    req.auth = {
      userId: claims.userId,
      username: claims.sub,
      email: claims.email,
      scope: claims.scope,
    };
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized: invalid or expired token' });
  }
};
