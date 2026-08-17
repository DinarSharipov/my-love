import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  ExpenseStatisticsQueryDto,
  ExpenseStatisticsResponseDto,
} from './dto/expense-statistics.dto';
import { ExpenseStatisticsService } from './expense-statistics.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/finance/expense-statistics', version: '1' })
export class ExpenseStatisticsController {
  constructor(private readonly statistics: ExpenseStatisticsService) {}

  @Get()
  @ApiOkResponse({ type: ExpenseStatisticsResponseDto })
  get(@CurrentUser() user: AuthenticatedUser, @Query() query: ExpenseStatisticsQueryDto) {
    return this.statistics.get(user.id, query);
  }
}
