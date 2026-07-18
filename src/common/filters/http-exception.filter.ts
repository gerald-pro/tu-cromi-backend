import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorCode } from '../enums/error-codes.enum';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ErrorCode.INTERNAL_ERROR;
    let message = 'Internal server error';
    let data: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        message = resp.message || exception.message;
        data = resp.data || null;
      }

      code = this.mapStatusToCode(exception, status);
    } else {
      this.logger.error(
        `Unhandled exception: ${(exception as Error).message}`,
        (exception as Error).stack,
      );
    }

    response.status(status).json({
      status: 'error',
      code,
      message: Array.isArray(message) ? message.join(', ') : message,
      data,
    });
  }

  private mapStatusToCode(exception: HttpException, status: number): ErrorCode {
    if (exception instanceof UnauthorizedException) {
      if (exception.message.includes('expired')) {
        return ErrorCode.AUTH_TOKEN_EXPIRED;
      }
      if (exception.message.includes('invalid')) {
        return ErrorCode.AUTH_TOKEN_INVALID;
      }
      return ErrorCode.UNAUTHORIZED;
    }

    if (exception instanceof ForbiddenException) {
      return ErrorCode.FORBIDDEN;
    }

    if (exception instanceof NotFoundException) {
      return ErrorCode.NOT_FOUND;
    }

    if (exception instanceof ConflictException) {
      return ErrorCode.CONFLICT;
    }

    if (exception instanceof BadRequestException) {
      const message = exception.getResponse();
      if (typeof message === 'object' && (message as any).message) {
        const messages = (message as any).message;
        if (Array.isArray(messages) && messages.length > 0) {
          return ErrorCode.VALIDATION_ERROR;
        }
      }
      return ErrorCode.BAD_REQUEST;
    }

    switch (status) {
      case 400:
        return ErrorCode.BAD_REQUEST;
      case 401:
        return ErrorCode.UNAUTHORIZED;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
