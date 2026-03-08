import {
  IsString,
  IsDateString,
  IsNumber,
  Min,
  Max,
  MinLength,
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
}
