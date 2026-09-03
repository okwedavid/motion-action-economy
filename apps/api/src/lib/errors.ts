export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, code = 'CONFLICT') {
    super(409, code, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, code = 'BAD_REQUEST', details?: unknown) {
    super(400, code, message, details);
  }
}

export class SystemError extends ApiError {
  constructor(message = 'Internal error', code = 'INTERNAL') {
    super(500, code, message);
  }
}
