/**
 * HTTP controller for auth endpoints. Validates request payloads and orchestrates backend services.
 */
import {
  introspectRequestSchema,
  loginRequestSchema,
  refreshTokenRequestSchema,
  registerRequestSchema,
} from '../dtos/auth.dto.js';
import { AuthServiceImpl } from '../services/impl/auth.service.impl.js';
import type { IAuthService } from '../services/impl/auth.service.interface.js';
import { asyncHandler } from '../utils/async-handler.js';

/**
 * Controller handling authentication-related requests.
 * Responsible for user registration, login, token refresh, introspection, and profile updates.
 */
export class AuthController {
  constructor(private readonly authService: IAuthService = new AuthServiceImpl()) {}

  /**
   * Handles user registration.
   * Parses and validates the request body using `registerRequestSchema`.
   * Calls the authService to create a new user and returns the user data with tokens.
   */
  register = asyncHandler(async (req, res) => {
    const payload = registerRequestSchema.parse(req.body);
    const result = await this.authService.register(payload);
    res.status(201).json(result);
  });

  /**
   * Handles user login.
   * Parses and validates the request body using `loginRequestSchema`.
   * Authenticates the user and returns tokens upon success.
   */
  login = asyncHandler(async (req, res) => {
    const payload = loginRequestSchema.parse(req.body);
    const result = await this.authService.login(payload);
    res.json(result);
  });

  /**
   * Refreshes the authentication token.
   * Validates the provided refresh token and generates a new pair of access and refresh tokens.
   */
  refresh = asyncHandler(async (req, res) => {
    const payload = refreshTokenRequestSchema.parse(req.body);
    const result = await this.authService.refreshToken(payload.refreshToken);
    res.json(result);
  });

  /**
   * Introspects a given token.
   * Checks the validity and decodes the payload of the provided access or refresh token.
   */
  introspect = asyncHandler(async (req, res) => {
    const payload = introspectRequestSchema.parse(req.body);
    const result = await this.authService.introspect(payload.token);
    res.json(result);
  });

  /**
   * Updates the authenticated user's profile information.
   * Requires a valid access token. Allows updating the user's full name and optionally their password.
   */
  updateProfile = asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const { fullName, password } = req.body;
    if (typeof fullName !== 'string') {
      res.status(400).json({ message: 'Invalid fullName' });
      return;
    }
    const result = await this.authService.updateProfile(userId, fullName, typeof password === 'string' ? password : undefined);
    res.json(result);
  });
}
