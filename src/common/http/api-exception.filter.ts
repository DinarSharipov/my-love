import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { errorCodeForStatus } from './api-error-code';

type ExceptionBody = Record<string, unknown> & {
  code?: string;
  details?: unknown;
  error?: string;
  message?: string | string[];
  statusCode?: number;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { id?: string }>();
    const response = context.getResponse<Response>();
    const requestId = request.id ?? randomUUID();
    response.setHeader('x-request-id', requestId);
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : undefined;
    const body: ExceptionBody =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as ExceptionBody)
        : { message: typeof exceptionResponse === 'string' ? exceptionResponse : undefined };
    const message = body.message ?? (isHttpException ? exception.message : 'Internal server error');
    const validationDetails = Array.isArray(message) ? { messages: message } : undefined;

    response.status(status).json({
      ...body,
      statusCode: status,
      code:
        body.code ??
        (status === 400 && validationDetails ? 'VALIDATION_FAILED' : errorCodeForStatus(status)),
      message,
      ...(body.details !== undefined || validationDetails
        ? { details: body.details ?? validationDetails }
        : {}),
      requestId,
    });
  }
}
