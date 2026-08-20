import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FinancialCategoryKind } from '@prisma/client';
import { ConcurrencyVersion } from '../../common/decorators/concurrency-version.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreateFinancialCategoryDto,
  FinancialCategoryResponseDto,
  UpdateFinancialCategoryDto,
} from './dto/financial-category.dto';
import { FinancialCategoriesService } from './financial-categories.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/financial-categories', version: '1' })
export class FinancialCategoriesController {
  constructor(private readonly categories: FinancialCategoriesService) {}

  @Post()
  @ApiCreatedResponse({ type: FinancialCategoryResponseDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFinancialCategoryDto) {
    return this.categories.create(user.id, dto);
  }

  @Get()
  @ApiOkResponse({ type: [FinancialCategoryResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser, @Query('kind') kind?: FinancialCategoryKind) {
    return this.categories.list(user.id, kind);
  }

  @Get('archived')
  @ApiOkResponse({ type: [FinancialCategoryResponseDto] })
  archived(@CurrentUser() user: AuthenticatedUser, @Query('kind') kind?: FinancialCategoryKind) {
    return this.categories.archived(user.id, kind);
  }

  @Patch(':id')
  @ApiOkResponse({ type: FinancialCategoryResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialCategoryDto,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.categories.update(user.id, id, dto, version);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.categories.archive(user.id, id, version);
  }

  @Post(':id/restore')
  @ApiOkResponse({ type: FinancialCategoryResponseDto })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.categories.restore(user.id, id, version);
  }
}
