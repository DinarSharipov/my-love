import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConcurrencyVersion } from '../../common/decorators/concurrency-version.decorator';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateFirstDateDto } from './dto/create-first-date.dto';
import { FirstDateResponseDto } from './dto/first-date-response.dto';
import { UpdateFirstDateDto } from './dto/update-first-date.dto';
import { FirstDateService } from './first-date.service';

@ApiTags('first date')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'first-date', version: '1' })
export class FirstDateController {
  constructor(private readonly firstDateService: FirstDateService) {}

  @Post()
  @Idempotent('first-date.create')
  @ApiOperation({ summary: 'Create the first date of the current family' })
  @ApiCreatedResponse({ type: FirstDateResponseDto })
  @ApiConflictResponse({ description: 'The first date already exists' })
  @ApiForbiddenResponse({ description: 'The current user does not belong to a family' })
  createFirstDate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFirstDateDto,
  ): Promise<FirstDateResponseDto> {
    return this.firstDateService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get the first date of the current family' })
  @ApiOkResponse({ type: FirstDateResponseDto })
  @ApiNotFoundResponse({ description: 'The first date does not exist' })
  @ApiForbiddenResponse({ description: 'The current user does not belong to a family' })
  findMyFirstDate(@CurrentUser() user: AuthenticatedUser): Promise<FirstDateResponseDto> {
    return this.firstDateService.findMine(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update the first date as a member of the current family' })
  @ApiOkResponse({ type: FirstDateResponseDto })
  @ApiBadRequestResponse({ description: 'At least one field must be provided' })
  @ApiNotFoundResponse({ description: 'The first date does not exist' })
  @ApiForbiddenResponse({ description: 'The current user does not belong to a family' })
  @ApiConflictResponse({ description: 'The supplied version is stale' })
  @ApiHeader({
    name: 'If-Match',
    required: false,
    description: 'Current resource version. Omit for backward-compatible last-write-wins behavior.',
  })
  updateFirstDate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFirstDateDto,
    @ConcurrencyVersion() expectedVersion?: number,
  ): Promise<FirstDateResponseDto> {
    return this.firstDateService.update(user.id, dto, expectedVersion);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete the first date created by the current user' })
  @ApiNoContentResponse({ description: 'The first date was deleted' })
  @ApiNotFoundResponse({ description: 'The first date does not exist' })
  @ApiForbiddenResponse({ description: 'Only the creator can delete the first date' })
  async removeFirstDate(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.firstDateService.remove(user.id);
  }
}
