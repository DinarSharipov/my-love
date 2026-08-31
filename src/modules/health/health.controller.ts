import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { OutboxMetrics, OutboxService } from '../../common/outbox/outbox.service';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Application and database readiness check' })
  @ApiOkResponse({ schema: { example: { status: 'ok', database: 'up' } } })
  async checkHealth(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }
  }

  @Get('outbox')
  @ApiOperation({ summary: 'Operational outbox counters without event payloads' })
  @ApiHeader({ name: 'x-ops-token', required: true })
  @ApiOkResponse({
    schema: {
      example: {
        generatedAt: '2026-08-31T12:00:00.000Z',
        pending: 0,
        retrying: 0,
        processing: 0,
        staleProcessing: 0,
        delivered: 120,
        failed: 0,
        oldestPendingAt: null,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Metrics endpoint is disabled or token is invalid' })
  async outboxMetrics(@Headers('x-ops-token') token?: string): Promise<OutboxMetrics> {
    const expectedToken = this.config.get<string>('OUTBOX_METRICS_TOKEN');
    if (!expectedToken || !token || !this.tokensMatch(expectedToken, token)) {
      throw new NotFoundException('Operational metrics not found');
    }
    return this.outbox.getMetrics();
  }

  private tokensMatch(expected: string, received: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    return (
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  }
}
