import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  FinancialAnalyticsQueryDto,
  FinancialAnalyticsResponseDto,
} from './dto/financial-analytics.dto';
import { FinancialAnalyticsService } from './financial-analytics.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/finance/analytics', version: '1' })
export class FinancialAnalyticsController {
  constructor(private readonly analytics: FinancialAnalyticsService) {}

  @Get()
  @ApiOkResponse({ type: FinancialAnalyticsResponseDto })
  get(@CurrentUser() user: AuthenticatedUser, @Query() query: FinancialAnalyticsQueryDto) {
    return this.analytics.get(user.id, query);
  }
}
