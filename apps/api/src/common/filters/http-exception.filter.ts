import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  constructor(private readonly i18n?: I18nService) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const rawMessage = (exception.getResponse() as any)?.message || exception.message || null;
    let translated: string | string[] | null = rawMessage;
    if (typeof rawMessage === 'string' && rawMessage.includes('.')) {
      try {
        translated = this.i18n ? (this.i18n.t(`common.${rawMessage}` as any) as any) : rawMessage;
      } catch {
        translated = rawMessage;
      }
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: translated,
    };

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception.stack,
        'HttpExceptionFilter',
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} - ${status} - ${rawMessage}`, 'HttpExceptionFilter');
    }

    response.status(status).json(errorResponse);
  }
}
