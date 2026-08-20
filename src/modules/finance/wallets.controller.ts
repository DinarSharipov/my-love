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
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { WalletResponseDto } from './dto/wallet-response.dto';
import { WalletsService } from './wallets.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/wallets', version: '1' })
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  @Post()
  @ApiCreatedResponse({ type: WalletResponseDto })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWalletDto) {
    return this.wallets.create(user.id, dto);
  }

  @Get()
  @ApiOkResponse({ type: [WalletResponseDto] })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.wallets.list(user.id);
  }

  @Get('archived')
  @ApiOkResponse({ type: [WalletResponseDto] })
  archived(@CurrentUser() user: AuthenticatedUser) {
    return this.wallets.archived(user.id);
  }

  @Get(':id')
  @ApiOkResponse({ type: WalletResponseDto })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.wallets.get(user.id, id);
  }

  @Patch(':id')
  @ApiOkResponse({ type: WalletResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWalletDto,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.wallets.update(user.id, id, dto, expectedVersion);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.wallets.archive(user.id, id, expectedVersion);
  }

  @Post(':id/restore')
  @ApiOkResponse({ type: WalletResponseDto })
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.wallets.restore(user.id, id, expectedVersion);
  }
}
