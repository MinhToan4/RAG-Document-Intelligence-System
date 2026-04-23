import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { toAuthUserDto } from '../../dtos/auth.dto.js';
import { UserRepository } from '../../repositories/user.repository.js';
import { AppError } from '../../utils/app-error.js';
import { generateAccessToken, generateRefreshToken, verifyTokenType } from '../../utils/jwt.js';
import type { UserRecord } from '../../types/index.js';
import type { AuthResult, IAuthService } from './auth.service.interface.js';

const BCRYPT_ROUNDS = 10;

export class AuthServiceImpl implements IAuthService {
  constructor(private readonly userRepository = new UserRepository()) {}

  async register(input: {
    username: string;
    email: string;
    password: string;
    fullName?: string;
  }): Promise<AuthResult> {
    const username = input.username.trim();
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName?.trim() || null;

    const existing = await this.userRepository.findByUsernameOrEmail(username, email);
    if (existing) {
      throw new AppError('Username or email already exists', 409);
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.userRepository.create({
      username,
      email,
      passwordHash,
      fullName,
    });

    return this.issueTokens(user);
  }

  async login(input: { username: string; password: string }): Promise<AuthResult> {
    const username = input.username.trim();
    const user = await this.userRepository.findByUsername(username);
    if (!user || !user.isActive) {
      throw new AppError('Invalid username or password', 401);
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid username or password', 401);
    }

    return this.issueTokens(user);
  }

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    let claims;
    try {
      claims = verifyTokenType(refreshToken, 'REFRESH');
    } catch {
      throw new AppError('Invalid refresh token', 401);
    }
    const userId = claims.userId;
    if (!userId) {
      throw new AppError('Invalid refresh token', 401);
    }

    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    return this.issueTokens(user);
  }

  async introspect(token: string): Promise<{ active: boolean }> {
    try {
      verifyTokenType(token, 'ACCESS');
      return { active: true };
    } catch {
      return { active: false };
    }
  }

  async updateProfile(userId: string, fullName: string, password?: string) {
    let passwordHash: string | undefined = undefined;
    if (password && password.trim().length > 0) {
      passwordHash = await bcrypt.hash(password.trim(), BCRYPT_ROUNDS);
    }
    const user = await this.userRepository.updateProfile(userId, fullName, passwordHash);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    return toAuthUserDto(user);
  }

  private issueTokens(user: UserRecord): AuthResult {
    return {
      user: toAuthUserDto(user),
      accessToken: generateAccessToken(user),
      refreshToken: generateRefreshToken(user),
      accessTokenExpiresIn: env.JWT_ACCESS_TOKEN_DURATION,
      refreshTokenExpiresIn: env.JWT_REFRESH_TOKEN_DURATION,
    };
  }
}
