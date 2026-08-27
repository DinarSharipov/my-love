import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConcurrencyVersion } from '../../common/decorators/concurrency-version.decorator';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateFamilyWishDto } from './dto/create-family-wish.dto';
import { FamilyWishesQueryDto } from './dto/family-wishes-query.dto';
import {
  FamilyWishResponseDto,
  PaginatedFamilyWishesResponseDto,
} from './dto/family-wish-response.dto';
import { UpdateFamilyWishDto } from './dto/update-family-wish.dto';
import { FamilyWishesService } from './family-wishes.service';

@ApiTags('family wishes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/wishes', version: '1' })
export class FamilyWishesController {
  constructor(private readonly wishes: FamilyWishesService) {}

  @Post()
  @Idempotent('family-wishes.create')
  @ApiOperation({ summary: 'Create a family wish' })
  @ApiCreatedResponse({ type: FamilyWishResponseDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFamilyWishDto) {
    return this.wishes.create(user.id, dto);
  }

  @Get()
  @ApiOkResponse({ type: PaginatedFamilyWishesResponseDto })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: FamilyWishesQueryDto) {
    return this.wishes.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: FamilyWishResponseDto })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wishes.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: FamilyWishResponseDto })
  @ApiConflictResponse({ description: 'The supplied version is stale' })
  @ApiHeader({ name: 'If-Match', required: false, description: 'Current resource version' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFamilyWishDto,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.wishes.update(user.id, id, dto, version);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.wishes.remove(user.id, id);
  }

  @Post(':id/accept')
  @Idempotent('family-wishes.accept')
  @ApiOkResponse({ type: FamilyWishResponseDto })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.wishes.accept(user.id, id, version);
  }

  @Post(':id/reject')
  @Idempotent('family-wishes.reject')
  @ApiOkResponse({ type: FamilyWishResponseDto })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.wishes.reject(user.id, id, version);
  }

  @Post(':id/mark-realized')
  @Idempotent('family-wishes.mark-realized')
  @ApiOkResponse({ type: FamilyWishResponseDto })
  markRealized(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.wishes.markRealized(user.id, id, version);
  }

  @Post(':id/confirm-realization')
  @Idempotent('family-wishes.confirm-realization')
  @ApiOkResponse({ type: FamilyWishResponseDto })
  confirmRealization(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.wishes.confirmRealization(user.id, id, version);
  }

  @Post(':id/reject-realization')
  @Idempotent('family-wishes.reject-realization')
  @ApiOkResponse({ type: FamilyWishResponseDto })
  rejectRealization(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.wishes.rejectRealization(user.id, id, version);
  }
}
