import { IsNumber, Min, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePacesDto {
  @ApiPropertyOptional({ 
    example: 4.5, 
    description: 'Average pace for 5K runs in min/km (e.g., 4:30 = 4.5)' 
  })
  @IsOptional()
  @IsNumber()
  @Min(3)
  pace5kMinPerKm?: number;

  @ApiPropertyOptional({ 
    example: 5.0, 
    description: 'Average pace for 10K runs in min/km (e.g., 5:00 = 5.0)' 
  })
  @IsOptional()
  @IsNumber()
  @Min(3)
  pace10kMinPerKm?: number;

  @ApiPropertyOptional({ 
    example: 5.25, 
    description: 'Average pace for 15K runs in min/km (e.g., 5:15 = 5.25)' 
  })
  @IsOptional()
  @IsNumber()
  @Min(3)
  pace15kMinPerKm?: number;

  @ApiPropertyOptional({ 
    example: 5.5, 
    description: 'Average pace for half marathon runs in min/km (e.g., 5:30 = 5.5)' 
  })
  @IsOptional()
  @IsNumber()
  @Min(3)
  paceHalfMarathonMinPerKm?: number;
}
