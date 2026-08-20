import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConcurrencyVersion } from '../../common/decorators/concurrency-version.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreateFinancialGoalContributionDto,
  CreateFinancialGoalDto,
  FinancialGoalContributionResponseDto,
  FinancialGoalResponseDto,
  UpdateFinancialGoalDto,
} from './dto/financial-goal.dto';
import { FinancialGoalsService } from './financial-goals.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/financial-goals', version: '1' })
export class FinancialGoalsController {
  constructor(private readonly goals: FinancialGoalsService) {}

  @Post()
  @ApiCreatedResponse({ type: FinancialGoalResponseDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFinancialGoalDto) {
    return this.goals.create(user.id, dto);
  }

  @Get()
  @ApiOkResponse({ type: [FinancialGoalResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.goals.list(user.id);
  }
  @Get('archived')
  @ApiOkResponse({ type: [FinancialGoalResponseDto] })
  archived(@CurrentUser() user: AuthenticatedUser) {
    return this.goals.listArchived(user.id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: FinancialGoalResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialGoalDto,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.goals.update(user.id, id, dto, version);
  }

  @Post(':id/contributions')
  @ApiCreatedResponse({ type: FinancialGoalContributionResponseDto })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Required retry key (8-128 safe ASCII characters).',
  })
  contribute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreateFinancialGoalContributionDto,
  ) {
    return this.goals.contribute(user.id, id, this.requiredKey(key), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.goals.archive(user.id, id, version);
  }
  @Post(':id/restore')
  @ApiOkResponse({ type: FinancialGoalResponseDto })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.goals.restore(user.id, id, version);
  }

  private requiredKey(key: string | undefined): string {
    if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key))
      throw new BadRequestException(
        'Idempotency-Key must contain 8-128 letters, digits, dots, underscores, colons or hyphens',
      );
    return key;
  }
}
