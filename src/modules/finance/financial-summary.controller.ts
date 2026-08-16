import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { FinancialSummaryQueryDto, FinancialSummaryResponseDto } from './dto/financial-summary.dto';
import { FinancialSummaryService } from './financial-summary.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/finance/summary', version: '1' })
export class FinancialSummaryController {
  constructor(private readonly summary: FinancialSummaryService) {}

  @Get()
  @ApiOkResponse({ type: FinancialSummaryResponseDto })
  get(@CurrentUser() user: AuthenticatedUser, @Query() query: FinancialSummaryQueryDto) {
    return this.summary.get(user.id, query);
  }
}
