import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsDateString, IsNumber, IsPositive, Min } from 'class-validator';

export class CreateTimeOffRequestDto {
  @ApiProperty({
    description: 'Unique identifier of the employee requesting time off',
    example: 'emp_12345',
  })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({
    description: 'Location identifier where the employee works',
    example: 'loc_nyc',
  })
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({
    description: 'Start date of the time-off period in ISO date format (YYYY-MM-DD)',
    example: '2025-07-10',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date of the time-off period in ISO date format (YYYY-MM-DD)',
    example: '2025-07-15',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Number of days requested (minimum 0.5, must be positive)',
    example: 3.5,
    minimum: 0.5,
  })
  @IsNumber()
  @IsPositive()
  @Min(0.5)
  daysRequested: number;
}