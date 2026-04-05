import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  status: 'success' | 'error';
  code: string;
  message: string;
  data: T | null;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((response) => {
        if (response && response.data !== undefined) {
          return {
            status: 'success',
            code: 'OK',
            message: response.message || 'Success',
            data: response.data,
          };
        }

        return {
          status: 'success',
          code: 'OK',
          message: response?.message || 'Success',
          data: response?.data ?? response ?? null,
        };
      }),
    );
  }
}
