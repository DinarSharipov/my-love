import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorResponseDto {
  @ApiProperty({ example: 400 }) statusCode: number;
  @ApiProperty({ example: 'BAD_REQUEST' }) code: string;
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] })
  message: string | string[];
  @ApiPropertyOptional({ example: 'Bad Request' }) error?: string;
  @ApiPropertyOptional({ type: Object, additionalProperties: true }) details?: unknown;
  @ApiProperty({ format: 'uuid' }) requestId: string;
}
