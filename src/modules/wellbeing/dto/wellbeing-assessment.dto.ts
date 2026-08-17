import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Max, Min } from 'class-validator';

export class CreateWellbeingAssessmentDto {
  @ApiProperty({ type: [Number], minItems: 5, maxItems: 5, minimum: 0, maximum: 5 })
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(5, { each: true })
  answers: number[];
}

export class WellbeingAssessmentResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ type: [Number] }) answers: number[];
  @ApiProperty({ minimum: 0, maximum: 25 }) score: number;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
}
