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
import { ConcurrencyVersion } from '../../common/decorators/concurrency-version.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  BudgetQueryDto,
  BudgetResponseDto,
  CreateBudgetDto,
  UpdateBudgetDto,
} from './dto/budget.dto';
import { BudgetsService } from './budgets.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/budgets', version: '1' })
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}
  @Post() @ApiCreatedResponse({ type: BudgetResponseDto }) create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBudgetDto,
  ) {
    return this.budgets.create(user.id, dto);
  }
  @Get() @ApiOkResponse({ type: [BudgetResponseDto] }) list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BudgetQueryDto,
  ) {
    return this.budgets.list(user.id, query);
  }
  @Patch(':id') @ApiOkResponse({ type: BudgetResponseDto }) update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.budgets.update(user.id, id, dto, version);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse() remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.budgets.remove(user.id, id, version);
  }
}
