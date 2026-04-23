export {};

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        username: string;
        email: string;
        scope: string;
      };
    }
  }
}
