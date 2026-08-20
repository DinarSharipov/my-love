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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConcurrencyVersion } from '../../common/decorators/concurrency-version.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreateMealPlanDto,
  CreateRecipeDto,
  GenerateShoppingDto,
  ListMealPlansQueryDto,
  MealPlanResponseDto,
  RecipeResponseDto,
  UpdateMealPlanDto,
  UpdateRecipeDto,
} from './dto/recipe.dto';
import { MealsService } from './meals.service';
@ApiTags('meals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'families/me/recipes', version: '1' })
export class MealsController {
  constructor(private readonly meals: MealsService) {}
  @Get() @ApiOkResponse({ type: [RecipeResponseDto] }) list(@CurrentUser() u: AuthenticatedUser) {
    return this.meals.list(u.id);
  }
  @Get('archived') @ApiOkResponse({ type: [RecipeResponseDto] }) listArchived(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.meals.listArchived(u.id);
  }
  @Post() @ApiOkResponse({ type: RecipeResponseDto }) create(
    @CurrentUser() u: AuthenticatedUser,
    @Body() dto: CreateRecipeDto,
  ) {
    return this.meals.create(u.id, dto);
  }
  @Patch(':id') @ApiOkResponse({ type: RecipeResponseDto }) update(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRecipeDto,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.meals.update(u.id, id, dto, expectedVersion);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse() archive(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.meals.archive(u.id, id, expectedVersion);
  }
  @Post(':id/restore') @ApiOkResponse({ type: RecipeResponseDto }) restore(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.meals.restore(u.id, id, expectedVersion);
  }
  @Post('plans') @ApiOkResponse({ type: MealPlanResponseDto }) createPlan(
    @CurrentUser() u: AuthenticatedUser,
    @Body() dto: CreateMealPlanDto,
  ) {
    return this.meals.createPlan(u.id, dto);
  }
  @Get('plans') @ApiOkResponse({ type: [MealPlanResponseDto] }) listPlans(
    @CurrentUser() u: AuthenticatedUser,
    @Query() query: ListMealPlansQueryDto,
  ) {
    return this.meals.listPlans(u.id, query.from, query.to);
  }
  @Patch('plans/:id') @ApiOkResponse({ type: MealPlanResponseDto }) updatePlan(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMealPlanDto,
    @ConcurrencyVersion() expectedVersion?: number,
  ) {
    return this.meals.updatePlan(u.id, id, dto, expectedVersion);
  }
  @Delete('plans/:id') @HttpCode(HttpStatus.NO_CONTENT) @ApiNoContentResponse() deletePlan(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.meals.deletePlan(u.id, id);
  }
  @Post('plans/:id/generate-shopping') generateShopping(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GenerateShoppingDto,
  ) {
    return this.meals.generateShopping(u.id, id, dto.listId);
  }
}
