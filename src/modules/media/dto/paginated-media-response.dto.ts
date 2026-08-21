import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from '../../../common/dto/pagination-response.dto';
import { MediaResponseDto } from './media-response.dto';

export class PaginatedMediaResponseDto extends PaginationResponseDto {
  @ApiProperty({ type: [MediaResponseDto] }) data: MediaResponseDto[];
}
