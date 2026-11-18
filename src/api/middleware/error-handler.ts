// Centralized Error Handler Middleware

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod/v4';

export interface ApiError extends Error {
  code?: string;
  statusCode?: number;
  details?: any;
}

export class ValidationError extends Error {
  constructor(message: string, public details: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Authorization denied', public statusCode: number = 403) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Resource not found', public statusCode: number = 404) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export function errorHandler(err: ApiError, req: Request, res: Response, next: NextFunction): Response | void {
  // Generate correlation ID for tracing
  const correlationId = (req.headers['x-correlation-id'] as string) || generateCorrelationId();

  // Log error with context (no sensitive data)
  console.error(`[${correlationId}] ${req.method} ${req.path} - ${err.name}: ${err.message}`, {
    correlationId,
    method: req.method,
    path: req.path,
    statusCode: err.statusCode || 500,
    errorName: err.name,
    errorMessage: err.message,
    // Don't log stack in production
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });

  // Handle Zod validation errors (Zod v4)
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
      correlationId,
    });
  }

  // Handle custom API errors
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';

  const errorResponse: any = {
    success: false,
    error: {
      code: errorCode,
      message: err.message,
    },
    correlationId,
  };

  // Include details for validation/authorization errors
  if (err.details) {
    errorResponse.error.details = err.details;
  }

  res.status(statusCode).json(errorResponse);
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}