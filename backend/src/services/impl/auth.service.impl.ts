/**
 * Service implementation for auth operations. Encapsulates domain workflows and provider/repository integration.
 */
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { toAuthUserDto } from '../../dtos/auth.dto.js';
import { UserRepository } from '../../repositories/user.repository.js';
import { AppError } from '../../utils/app-error.js';
import { generateAccessToken, generateRefreshToken, verifyTokenType } from '../../utils/jwt.js';
import type { UserRecord } from '../../types/index.js';
import type { AuthResult, IAuthService } from './auth.service.interface.js';

const BCRYPT_ROUNDS = 10;

/**
 * Implementation of the Authentication Service.
 * Handles user registration, login, token management, and profile updates.
 * Uses bcrypt for secure password hashing and JWT for session management.
 */
export class AuthServiceImpl implements IAuthService {
  constructor(private readonly userRepository = new UserRepository()) {}

  /**
   * Registers a new user in the system.
   * Validates if the username or email already exists, hashes the password,
   * creates the user record, and issues JWT tokens for immediate login.
   *
   * @param input - The registration payload including username, email, password, and optional full name
   * @returns An AuthResult containing the user details and access/refresh tokens
   */
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

  /**
   * Authenticates a user using their username and password.
   * Verifies the credentials against the hashed password in the database
   * and returns JWT tokens upon successful authentication.
   *
   * @param input - The login payload containing username and password
   * @returns An AuthResult containing the user details and access/refresh tokens
   */
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

  /**
   * Refreshes the user's session using a valid refresh token.
   * Verifies the token, ensures the user still exists and is active,
   * and issues a new pair of access and refresh tokens.
   *
   * @param refreshToken - The refresh token string provided by the client
   * @returns An AuthResult containing the new tokens
   */
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

  /**
   * Introspects a given access token to check if it is still active and valid.
   *
   * @param token - The JWT access token to verify
   * @returns An object indicating whether the token is active
   */
  async introspect(token: string): Promise<{ active: boolean }> {
    try {
      verifyTokenType(token, 'ACCESS');
      return { active: true };
    } catch {
      return { active: false };
    }
  }

  /**
   * Updates the profile information of a specific user.
   * Allows updating the user's full name and optionally changing their password.
   *
   * @param userId - The ID of the user to update
   * @param fullName - The new full name
   * @param password - An optional new password to set
   * @returns The updated user details mapped to a DTO
   */
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

  /**
   * Private helper method to generate a new set of JWT access and refresh tokens for a user.
   *
   * @param user - The UserRecord entity to issue tokens for
   * @returns An AuthResult containing the user DTO and the generated tokens
   */
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
