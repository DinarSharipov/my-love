import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreateLedgerCommandDto,
  CreateTransferCommandDto,
  ReverseLedgerTransactionDto,
} from './dto/ledger-command.dto';
import { LedgerHistoryQueryDto } from './dto/ledger-history-query.dto';
import { LedgerTransactionResponseDto } from './dto/ledger-transaction-response.dto';
import { PaginatedLedgerTransactionsResponseDto } from './dto/paginated-ledger-transactions-response.dto';
import { LedgerCommandsService } from './ledger-commands.service';
import { LedgerHistoryService } from './ledger-history.service';
import { LedgerTransactionMediaService } from './ledger-transaction-media.service';
import { AttachLedgerTransactionMediaDto } from './dto/attach-ledger-transaction-media.dto';
import { MediaResponseDto } from '../media/dto/media-response.dto';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/ledger', version: '1' })
export class LedgerCommandsController {
  constructor(
    private readonly commands: LedgerCommandsService,
    private readonly history: LedgerHistoryService,
    private readonly transactionMedia: LedgerTransactionMediaService,
  ) {}

  @Get()
  @ApiOkResponse({ type: PaginatedLedgerTransactionsResponseDto })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: LedgerHistoryQueryDto) {
    return this.history.list(user.id, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: LedgerTransactionResponseDto })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.history.get(user.id, id);
  }

  @Get(':id/media')
  @ApiOperation({ summary: 'List media attached to a ledger transaction' })
  @ApiOkResponse({ type: [MediaResponseDto] })
  @ApiNotFoundResponse({ description: 'Transaction is not visible to the current user' })
  listMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MediaResponseDto[]> {
    return this.transactionMedia.list(id, user.id);
  }

  @Post(':id/media')
  @ApiOperation({ summary: 'Attach family media to a ledger transaction' })
  @ApiOkResponse({ type: [MediaResponseDto] })
  @ApiNotFoundResponse({ description: 'Transaction or media is not visible to the current user' })
  attachMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachLedgerTransactionMediaDto,
  ): Promise<MediaResponseDto[]> {
    return this.transactionMedia.attach(id, user.id, dto.mediaId);
  }

  @Delete(':id/media/:mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Detach media from a ledger transaction' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Transaction is not visible to the current user' })
  detachMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ): Promise<void> {
    return this.transactionMedia.detach(id, user.id, mediaId);
  }

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

  @Post(':id/reversal')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: LedgerTransactionResponseDto })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Required retry key (8-128 safe ASCII characters).',
  })
  reverse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() dto: ReverseLedgerTransactionDto,
  ) {
    return this.commands.reverse(user.id, id, this.requiredKey(key), dto);
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
