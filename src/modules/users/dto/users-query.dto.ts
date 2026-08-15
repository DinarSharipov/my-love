import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class UsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by first name, last name or email', minLength: 2 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(320)
  search?: string;
}
