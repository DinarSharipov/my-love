import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { PublicUserResponseDto } from './dto/public-user-response.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Search the user registry' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: UsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    return this.usersService.findRegistry(currentUser.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a public user profile' })
  @ApiOkResponse({ type: PublicUserResponseDto })
  @ApiNotFoundResponse()
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicUserResponseDto> {
    return this.usersService.findPublicById(id);
  }
}
