import { ArgumentsHost, BadRequestException, Catch, HttpException } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

type SocketAck = (response: unknown) => void;

@Catch()
export class MessengerWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const [client, payload, acknowledgement] =
      host.getArgs<
        [
          { emit: (event: string, response: unknown) => void },
          { requestId?: unknown } | undefined,
          SocketAck | undefined,
        ]
      >();
    const response = {
      ok: false,
      requestId: typeof payload?.requestId === 'string' ? payload.requestId : null,
      error: this.error(exception),
    };
    if (typeof acknowledgement === 'function') {
      acknowledgement(response);
      return;
    }
    client.emit('command.error', response);
  }

  private error(exception: unknown): { code: string; message: string } {
    if (exception instanceof WsException) {
      const error = exception.getError();
      if (typeof error === 'object' && error && 'code' in error && 'message' in error) {
        return error as { code: string; message: string };
      }
      return {
        code: 'REQUEST_REJECTED',
        message: typeof error === 'string' ? error : JSON.stringify(error),
      };
    }
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'object' && response && 'message' in response
          ? Array.isArray(response.message)
            ? response.message.join('; ')
            : String(response.message)
          : exception.message;
      return {
        code: exception instanceof BadRequestException ? 'VALIDATION_ERROR' : 'REQUEST_REJECTED',
        message,
      };
    }
    return {
      code: 'REQUEST_REJECTED',
      message: exception instanceof Error ? exception.message : 'Request failed',
    };
  }
}
