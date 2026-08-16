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
  CreateRecurringPaymentDto,
  RecurringPaymentForecastResponseDto,
  RecurringPaymentResponseDto,
  UpdateRecurringPaymentDto,
} from './dto/recurring-payment.dto';
import { RecurringPaymentsService } from './recurring-payments.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/recurring-payments', version: '1' })
export class RecurringPaymentsController {
  constructor(private readonly payments: RecurringPaymentsService) {}
  @Post()
  @ApiCreatedResponse({ type: RecurringPaymentResponseDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRecurringPaymentDto) {
    return this.payments.create(user.id, dto);
  }
  @Get()
  @ApiOkResponse({ type: [RecurringPaymentResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.payments.list(user.id);
  }
  @Get(':id/forecasts')
  @ApiOkResponse({ type: [RecurringPaymentForecastResponseDto] })
  forecasts(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.payments.listForecasts(user.id, id);
  }
  @Patch(':id')
  @ApiOkResponse({ type: RecurringPaymentResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringPaymentDto,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.payments.update(user.id, id, dto, version);
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() version?: number,
  ) {
    return this.payments.archive(user.id, id, version);
  }
}
