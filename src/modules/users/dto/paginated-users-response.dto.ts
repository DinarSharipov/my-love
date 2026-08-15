import { ApiProperty } from '@nestjs/swagger';
import { PaginationResponseDto } from '../../../common/dto/pagination-response.dto';
import { PublicUserResponseDto } from './public-user-response.dto';

export class PaginatedUsersResponseDto extends PaginationResponseDto {
  @ApiProperty({ type: [PublicUserResponseDto] }) data: PublicUserResponseDto[];
}
