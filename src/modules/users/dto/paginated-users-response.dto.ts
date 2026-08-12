import { ApiProperty } from '@nestjs/swagger';
import { PublicUserResponseDto } from './public-user-response.dto';

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [PublicUserResponseDto] }) data: PublicUserResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
