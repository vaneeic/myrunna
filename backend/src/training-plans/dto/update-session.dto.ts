import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

type SessionType =
  | 'easy_run'
  | 'long_run'
  | 'tempo'
  | 'intervals'
  | 'recovery'
  | 'race'
  | 'rest';

export class UpdateSessionDto {
  @ApiProperty({ example: '2026-04-01', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({
    example: 'easy_run',
    enum: ['easy_run', 'long_run', 'tempo', 'intervals', 'recovery', 'race', 'rest'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['easy_run', 'long_run', 'tempo', 'intervals', 'recovery', 'race', 'rest'])
  sessionType?: SessionType;

  @ApiProperty({ example: 'Easy aerobic run', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 8.5, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  plannedDistanceKm?: number;

  @ApiProperty({ example: 45, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(480)
  plannedDurationMin?: number;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
