import {
  introspectRequestSchema,
  loginRequestSchema,
  refreshTokenRequestSchema,
  registerRequestSchema,
} from '../dtos/auth.dto.js';
import { AuthServiceImpl } from '../services/impl/auth.service.impl.js';
import type { IAuthService } from '../services/impl/auth.service.interface.js';
import { asyncHandler } from '../utils/async-handler.js';

export class AuthController {
  constructor(private readonly authService: IAuthService = new AuthServiceImpl()) {}

  register = asyncHandler(async (req, res) => {
    const payload = registerRequestSchema.parse(req.body);
    const result = await this.authService.register(payload);
    res.status(201).json(result);
  });

  login = asyncHandler(async (req, res) => {
    const payload = loginRequestSchema.parse(req.body);
    const result = await this.authService.login(payload);
    res.json(result);
  });

  refresh = asyncHandler(async (req, res) => {
    const payload = refreshTokenRequestSchema.parse(req.body);
    const result = await this.authService.refreshToken(payload.refreshToken);
    res.json(result);
  });

  introspect = asyncHandler(async (req, res) => {
    const payload = introspectRequestSchema.parse(req.body);
    const result = await this.authService.introspect(payload.token);
    res.json(result);
  });

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
