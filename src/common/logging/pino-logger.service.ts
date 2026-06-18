import { LoggerService, Injectable } from '@nestjs/common';
import pino from 'pino';

@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger: pino.Logger;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: !isProduction
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    });
  }

  log(message: any, ...optionalParams: any[]) {
    this.logger.info({ context: optionalParams[0] }, message);
  }

  error(message: any, ...optionalParams: any[]) {
    this.logger.error({ context: optionalParams[1], trace: optionalParams[0] }, message);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.logger.warn({ context: optionalParams[0] }, message);
  }

  debug(message: any, ...optionalParams: any[]) {
    this.logger.debug({ context: optionalParams[0] }, message);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.logger.trace({ context: optionalParams[0] }, message);
  }
}
