export {};

declare global {
  namespace Express {
    interface Request {
      /** Set by src/middleware/auth.ts after verifying the Bearer token. */
      userId?: string;
    }
  }
}
