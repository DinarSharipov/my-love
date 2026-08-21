import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiHeader,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { ConcurrencyVersion } from '../../common/decorators/concurrency-version.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';
import { PublicUserResponseDto } from './dto/public-user-response.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { UsersService } from './users.service';
import { UpdateCurrentUserDto } from './dto/update-current-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { AccountExportResponseDto } from './dto/account-export-response.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  findCurrentUser(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    return this.usersService.findCurrent(user.id);
  }

  @Get('me/export')
  @ApiOperation({ summary: 'Export the current account data' })
  @ApiOkResponse({ type: AccountExportResponseDto })
  exportCurrentUser(@CurrentUser() user: AuthenticatedUser): Promise<AccountExportResponseDto> {
    return this.usersService.exportCurrent(user.id);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload or replace the current user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: UserResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: tmpdir(),
        filename: (_request, file, callback) =>
          callback(null, `${randomUUID()}-${file.originalname}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_request, file, callback) =>
        callback(
          file.mimetype.startsWith('image/')
            ? null
            : new BadRequestException('Avatar must be an image'),
          file.mimetype.startsWith('image/'),
        ),
    }),
  )
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UserResponseDto> {
    return this.usersService.uploadAvatar(user.id, file as Express.Multer.File);
  }

  @Delete('me/avatar')
  @ApiOperation({ summary: 'Remove the current user avatar' })
  @ApiOkResponse({ schema: { example: { deleted: true } } })
  async removeAvatar(@CurrentUser() user: AuthenticatedUser): Promise<{ deleted: true }> {
    await this.usersService.removeAvatar(user.id);
    return { deleted: true };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  @ApiHeader({ name: 'If-Match', required: false, description: 'Optional current profile version' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'The supplied profile version is stale' })
  updateCurrentUser(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCurrentUserDto,
    @ConcurrencyVersion() version?: number,
  ): Promise<UserResponseDto> {
    return this.usersService.updateCurrent(user.id, dto, version);
  }

  @Get()
  @ApiOperation({ summary: 'Search the user registry' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  findUsers(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: UsersQueryDto,
  ): Promise<PaginatedUsersResponseDto> {
    return this.usersService.findRegistry(currentUser.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a public user profile' })
  @ApiOkResponse({ type: PublicUserResponseDto })
  @ApiNotFoundResponse()
  findUserById(@Param('id', ParseUUIDPipe) id: string): Promise<PublicUserResponseDto> {
    return this.usersService.findPublicById(id);
  }
}
