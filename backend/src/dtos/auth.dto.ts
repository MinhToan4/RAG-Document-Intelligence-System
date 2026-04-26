/**
 * DTO and validation schema module for auth payloads.
 */
import { z } from 'zod';
import type { UserRecord } from '../types/index.js';

export const registerRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'username must be at least 3 characters')
    .max(50, 'username must not exceed 50 characters'),
  email: z.string().trim().email('email is invalid'),
  password: z
    .string()
    .min(8, 'password must be at least 8 characters')
    .max(100, 'password must not exceed 100 characters'),
  fullName: z.string().trim().max(100).optional(),
});

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1, 'username is required'),
  password: z.string().min(1, 'password is required'),
});

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export const introspectRequestSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

export type RegisterRequestDto = z.infer<typeof registerRequestSchema>;
export type LoginRequestDto = z.infer<typeof loginRequestSchema>;
export type RefreshTokenRequestDto = z.infer<typeof refreshTokenRequestSchema>;
export type IntrospectRequestDto = z.infer<typeof introspectRequestSchema>;

export type AuthUserDto = {
  id: string;
  username: string;
  email: string;
  fullName: string | null;
  role: string;
};

export type AuthResponseDto = {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

export function toAuthUserDto(user: UserRecord): AuthUserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}
