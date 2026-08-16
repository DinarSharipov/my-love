import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateLedgerCommandDto, CreateTransferCommandDto } from './dto/ledger-command.dto';
import { LedgerTransactionResponseDto } from './dto/ledger-transaction-response.dto';
import { LedgerCommandsService } from './ledger-commands.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/ledger', version: '1' })
export class LedgerCommandsController {
  constructor(private readonly commands: LedgerCommandsService) {}

  @Post('income')
  @ApiCreatedResponse({ type: LedgerTransactionResponseDto })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Required retry key (8-128 safe ASCII characters).',
  })
  income(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreateLedgerCommandDto,
  ) {
    return this.commands.income(user.id, this.requiredKey(key), dto);
  }

  @Post('expense')
  @ApiCreatedResponse({ type: LedgerTransactionResponseDto })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Required retry key (8-128 safe ASCII characters).',
  })
  expense(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreateLedgerCommandDto,
  ) {
    return this.commands.expense(user.id, this.requiredKey(key), dto);
  }

  @Post('transfer')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: LedgerTransactionResponseDto })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Required retry key (8-128 safe ASCII characters).',
  })
  transfer(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: CreateTransferCommandDto,
  ) {
    return this.commands.transfer(user.id, this.requiredKey(key), dto);
  }

  private requiredKey(key: string | undefined): string {
    if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
      throw new BadRequestException(
        'Idempotency-Key must contain 8-128 letters, digits, dots, underscores, colons or hyphens',
      );
    }
    return key;
  }
}
