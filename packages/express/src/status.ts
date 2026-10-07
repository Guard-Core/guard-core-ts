/* The adapter guard surface status route (fastapi-guard/guard/status.py
   add_status_route): a GET endpoint answering the middleware's
   get_initialization_status() as JSON, hidden from generated docs. */

import type { Express, Request, Response, NextFunction } from 'express';
import type { GuardMiddlewareSurface } from './middleware.js';

export const DEFAULT_STATUS_PATH = '/_guard/status';

export function addStatusRoute(
  app: Express,
  guard: GuardMiddlewareSurface,
  path: string = DEFAULT_STATUS_PATH,
): void {
  app.get(path, (_req: Request, res: Response, _next: NextFunction) => {
    res.json(guard.getInitializationStatus());
  });
}
