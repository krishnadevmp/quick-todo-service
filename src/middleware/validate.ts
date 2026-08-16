import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';

/** Validates+replaces req.body with the parsed (and defaulted/coerced) result. */
export function validateBody<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body) as z.infer<T>;
    next();
  };
}

/** Validates+replaces req.query with the parsed result. */
export function validateQuery<T extends ZodTypeAny>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.query = schema.parse(req.query) as unknown as Request['query'];
    next();
  };
}
