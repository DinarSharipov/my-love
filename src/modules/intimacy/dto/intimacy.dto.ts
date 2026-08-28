import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntimacyMood, IntimacyPreference, IntimacyRating } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { IsLocalDate } from '../../../common/validation/date-time.decorators';

export class UpsertIntimacyCheckInDto {
  @ApiProperty({ enum: IntimacyMood })
  @IsEnum(IntimacyMood)
  mood!: IntimacyMood;

  @ApiProperty({ minimum: 1, maximum: 5, example: 3 })
  @IsInt()
  @Min(1)
  @Max(5)
  desireLevel!: number;

  @ApiProperty({ enum: IntimacyPreference, isArray: true, required: false })
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsEnum(IntimacyPreference, { each: true })
  preferences: IntimacyPreference[] = [];
}

export class IntimacyCalendarQueryDto {
  @ApiProperty({ example: '2026-08-01' })
  @IsLocalDate()
  from!: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsLocalDate()
  to!: string;
}

export class UpsertIntimacyEventDto {
  @ApiProperty()
  @IsBoolean()
  occurred!: boolean;

  @ApiPropertyOptional({ enum: IntimacyRating, nullable: true })
  @IsOptional()
  @IsEnum(IntimacyRating)
  rating?: IntimacyRating | null;
}

export class IntimacyCheckInPrivateDto {
  @ApiProperty({ enum: IntimacyMood })
  mood!: IntimacyMood;

  @ApiProperty()
  desireLevel!: number;

  @ApiProperty({ enum: IntimacyPreference, isArray: true })
  preferences!: IntimacyPreference[];
}

export class IntimacyAggregateDto {
  @ApiProperty()
  hasMutualInterest!: boolean;

  @ApiProperty({ enum: IntimacyPreference, isArray: true })
  matchedPreferences!: IntimacyPreference[];
}

export class IntimacyCheckInResponseDto {
  @ApiProperty({ example: '2026-08-28' })
  date!: string;

  @ApiProperty({ type: IntimacyCheckInPrivateDto, nullable: true })
  myCheckIn!: IntimacyCheckInPrivateDto | null;

  @ApiProperty()
  partnerHasAnswered!: boolean;

  @ApiProperty({ type: IntimacyAggregateDto, nullable: true })
  aggregate!: IntimacyAggregateDto | null;
}

export class IntimacyCalendarDayDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  myCheckInExists!: boolean;

  @ApiProperty()
  partnerCheckInExists!: boolean;

  @ApiProperty({ nullable: true })
  hasMutualInterest!: boolean | null;

  @ApiProperty()
  intimacyEventExists!: boolean;
}

export class IntimacyEventResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  date!: string;

  @ApiProperty()
  occurred!: boolean;

  @ApiPropertyOptional({ enum: IntimacyRating, nullable: true })
  rating!: IntimacyRating | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
