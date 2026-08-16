import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConcurrencyVersion } from '../../common/decorators/concurrency-version.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreateShoppingItemDto,
  CreateShoppingListDto,
  ShoppingItemResponseDto,
  ShoppingListResponseDto,
} from './dto/shopping.dto';
import { ShoppingService } from './shopping.service';
@ApiTags('shopping')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/shopping-lists', version: '1' })
export class ShoppingController {
  constructor(private readonly shopping: ShoppingService) {}
  @Get() @ApiOkResponse({ type: [ShoppingListResponseDto] }) lists(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.shopping.lists(u.id);
  }
  @Post() @ApiOkResponse({ type: ShoppingListResponseDto }) create(
    @CurrentUser() u: AuthenticatedUser,
    @Body() dto: CreateShoppingListDto,
  ) {
    return this.shopping.createList(u.id, dto);
  }
  @Post(':listId/items') @ApiOkResponse({ type: ShoppingItemResponseDto }) add(
    @CurrentUser() u: AuthenticatedUser,
    @Param('listId') id: string,
    @Body() dto: CreateShoppingItemDto,
  ) {
    return this.shopping.addItem(u.id, id, dto);
  }
  @Post(':listId/items/:itemId/check') @ApiOkResponse({ type: ShoppingItemResponseDto }) check(
    @CurrentUser() u: AuthenticatedUser,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.shopping.checkItem(u.id, listId, itemId, true, expectedVersion);
  }
  @Post(':listId/items/:itemId/uncheck') @ApiOkResponse({ type: ShoppingItemResponseDto }) uncheck(
    @CurrentUser() u: AuthenticatedUser,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.shopping.checkItem(u.id, listId, itemId, false, expectedVersion);
  }
  @Delete(':listId') @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse() archive(
    @CurrentUser() u: AuthenticatedUser,
    @Param('listId') id: string,
  ) {
    return this.shopping.archiveList(u.id, id);
  }
}
