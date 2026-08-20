import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
export class RecipeIngredientDto {
  @ApiProperty({ maxLength: 160 }) @IsString() @MinLength(1) @MaxLength(160) name: string;
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  quantity?: string;
}
export class CreateRecipeDto {
  @ApiProperty({ maxLength: 160 }) @IsString() @MinLength(1) @MaxLength(160) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) instructions?: string;
  @ApiProperty({ type: [RecipeIngredientDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];
  @ApiPropertyOptional({ type: [String], maxItems: 12 })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  dietaryLabels?: string[];
}
export class UpdateRecipeDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  instructions?: string | null;
  @ApiPropertyOptional({ type: [RecipeIngredientDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients?: RecipeIngredientDto[];
  @ApiPropertyOptional({ type: [String], maxItems: 12 })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  dietaryLabels?: string[];
}
export class RecipeDietaryLabelResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() label: string;
}
export class RecipeIngredientResponseDto extends RecipeIngredientDto {
  @ApiProperty() id: string;
}
export class RecipeResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() familyId: string;
  @ApiProperty() createdById: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) instructions: string | null;
  @ApiProperty() archived: boolean;
  @ApiProperty() version: number;
  @ApiProperty({ type: [RecipeIngredientResponseDto] }) ingredients: RecipeIngredientResponseDto[];
  @ApiProperty({ type: [RecipeDietaryLabelResponseDto] })
  dietaryLabels: RecipeDietaryLabelResponseDto[];
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
export class CreateMealPlanDto {
  @ApiProperty({ format: 'date' }) @IsDateString() plannedFor: string;
  @ApiProperty({ maxLength: 40 }) @IsString() @MinLength(1) @MaxLength(40) mealSlot: string;
  @ApiProperty() @IsString() recipeId: string;
  @ApiPropertyOptional({ minimum: 1, default: 1 }) @IsOptional() @IsInt() @Min(1) servings?: number;
}
export class UpdateMealPlanDto {
  @ApiPropertyOptional({ format: 'date' }) @IsOptional() @IsDateString() plannedFor?: string;
  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  mealSlot?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() recipeId?: string;
  @ApiPropertyOptional({ minimum: 1 }) @IsOptional() @IsInt() @Min(1) servings?: number;
}
export class ListMealPlansQueryDto {
  @ApiPropertyOptional({ format: 'date', example: '2026-08-17' })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;
  @ApiPropertyOptional({ format: 'date', example: '2026-08-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}
export class MealPlanResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() familyId: string;
  @ApiProperty() createdById: string;
  @ApiProperty() recipeId: string;
  @ApiProperty({ format: 'date' }) plannedFor: Date;
  @ApiProperty() mealSlot: string;
  @ApiProperty() servings: number;
  @ApiProperty() version: number;
  @ApiProperty({ type: RecipeResponseDto }) recipe: RecipeResponseDto;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
export class GenerateShoppingDto {
  @ApiProperty() @IsString() listId: string;
}
