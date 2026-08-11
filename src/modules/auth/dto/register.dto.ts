import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Иван' }) @IsString() @MinLength(1) @MaxLength(100) firstName: string;
  @ApiProperty({ example: 'Иванов' }) @IsString() @MinLength(1) @MaxLength(100) lastName: string;
  @ApiProperty({ example: 'ivan@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email: string;
  @ApiProperty({ minLength: 8, example: 'StrongPassword123!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
  @ApiProperty({ enum: Gender, example: Gender.MALE }) @IsEnum(Gender) gender: Gender;
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
  @ApiProperty({ format: 'date', example: '1995-05-20' })
  @IsDateString({ strict: true })
  birthDate: string;
  @ApiPropertyOptional({ example: '+79991234567' }) @IsOptional() @IsPhoneNumber() phone?: string;
}
