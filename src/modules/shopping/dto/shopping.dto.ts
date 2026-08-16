import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
export class CreateShoppingListDto {
  @ApiProperty({ maxLength: 150 }) @IsString() @MinLength(1) @MaxLength(150) name: string;
}
export class CreateShoppingItemDto {
  @ApiProperty({ maxLength: 200 }) @IsString() @MinLength(1) @MaxLength(200) name: string;
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  quantity?: string;
}
export class ShoppingItemResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() listId: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) quantity: string | null;
  @ApiProperty() checked: boolean;
  @ApiProperty() version: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
}
export class ShoppingListResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() familyId: string;
  @ApiProperty() name: string;
  @ApiProperty() archived: boolean;
  @ApiProperty() version: number;
  @ApiProperty({ type: [ShoppingItemResponseDto] }) items: ShoppingItemResponseDto[];
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
}
