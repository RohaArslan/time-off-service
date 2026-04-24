import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min } from 'class-validator';

export class HcmBalanceDto {
  @ApiProperty({
    description: 'Employee identifier from the HCM system',
    example: 'EMP001',
  })
  @IsString()
  employeeId: string;

  @ApiProperty({
    description: 'Location identifier from the HCM system',
    example: 'LOC_ATLANTA',
  })
  @IsString()
  locationId: string;

  @ApiProperty({
    description: 'Available time-off days for this employee and location',
    example: 12.5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  availableDays: number;
}