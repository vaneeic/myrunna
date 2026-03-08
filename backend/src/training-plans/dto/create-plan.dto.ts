import {
  IsString,
  IsDateString,
  IsNumber,
  Min,
  Max,
  MinLength,
  IsOptional,
  IsInt,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiProperty({ example: 'Paris Marathon 2026' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: 'Marathon' })
  @IsString()
  @MinLength(2)
  goalEvent: string;

  @ApiProperty({ example: '2026-04-05' })
  @IsDateString()
  goalDate: string;

  @ApiProperty({ example: 40, description: 'Current weekly running volume in km' })
  @IsNumber()
  @Min(0)
  @Max(300)
  currentWeeklyVolumeKm: number;

  @ApiProperty({ 
    example: 3, 
    description: 'Number of runs per week',
    required: false,
    default: 3
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  runsPerWeek?: number;

  @ApiProperty({ 
    example: 2, 
    description: 'Day of week for easy runs (0=Sunday, 1=Monday, ..., 6=Saturday)',
    required: false
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  easyRunDay?: number;

  @ApiProperty({ 
    example: 0, 
    description: 'Day of week for long runs (0=Sunday, 1=Monday, ..., 6=Saturday)',
    required: false
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  longRunDay?: number;

  @ApiProperty({ 
    example: 4, 
    description: 'Day of week for interval/mixed runs (0=Sunday, 1=Monday, ..., 6=Saturday)',
    required: false
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  intervalRunDay?: number;
}
