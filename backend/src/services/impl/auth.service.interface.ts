import type { AuthUserDto } from '../../dtos/auth.dto.js';

export type AuthResult = {
  user: AuthUserDto;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

export interface IAuthService {
  register(input: {
    username: string;
    email: string;
    password: string;
    fullName?: string;
  }): Promise<AuthResult>;
  login(input: { username: string; password: string }): Promise<AuthResult>;
  refreshToken(refreshToken: string): Promise<AuthResult>;
  introspect(token: string): Promise<{ active: boolean }>;
  updateProfile(userId: string, fullName: string, password?: string): Promise<AuthUserDto>;
}
