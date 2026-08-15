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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateShoppingItemDto, CreateShoppingListDto } from './dto/shopping.dto';
import { ShoppingService } from './shopping.service';
@ApiTags('shopping')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/shopping-lists', version: '1' })
export class ShoppingController {
  constructor(private readonly shopping: ShoppingService) {}
  @Get() @ApiOkResponse() lists(@CurrentUser() u: AuthenticatedUser) {
    return this.shopping.lists(u.id);
  }
  @Post() @ApiOkResponse() create(
    @CurrentUser() u: AuthenticatedUser,
    @Body() dto: CreateShoppingListDto,
  ) {
    return this.shopping.createList(u.id, dto);
  }
  @Post(':listId/items') @ApiOkResponse() add(
    @CurrentUser() u: AuthenticatedUser,
    @Param('listId') id: string,
    @Body() dto: CreateShoppingItemDto,
  ) {
    return this.shopping.addItem(u.id, id, dto);
  }
  @Post(':listId/items/:itemId/check') @ApiOkResponse() check(
    @CurrentUser() u: AuthenticatedUser,
    @Param('itemId') id: string,
  ) {
    return this.shopping.checkItem(u.id, id, true);
  }
  @Post(':listId/items/:itemId/uncheck') @ApiOkResponse() uncheck(
    @CurrentUser() u: AuthenticatedUser,
    @Param('itemId') id: string,
  ) {
    return this.shopping.checkItem(u.id, id, false);
  }
  @Delete(':listId') @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse() archive(
    @CurrentUser() u: AuthenticatedUser,
    @Param('listId') id: string,
  ) {
    return this.shopping.archiveList(u.id, id);
  }
}
