import { ApiProperty } from '@nestjs/swagger';

export class PaginationResponseDto {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export function paginationMeta(total: number, page: number, limit: number): PaginationResponseDto {
  return { total, page, limit, totalPages: Math.ceil(total / limit) };
}
