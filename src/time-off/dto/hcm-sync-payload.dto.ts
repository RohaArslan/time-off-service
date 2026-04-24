import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ValidateNested, IsArray, ArrayMinSize } from 'class-validator';
import { HcmBalanceDto } from './hcm-balance.dto';

export class HcmSyncPayloadDto {
  @ApiProperty({
    description: 'Array of balances to synchronize from the HCM system',
    type: [HcmBalanceDto],
    example: [
      { employeeId: 'EMP001', locationId: 'LOC_ATLANTA', availableDays: 15.0 },
      { employeeId: 'EMP002', locationId: 'LOC_NYC', availableDays: 8.5 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HcmBalanceDto)
  balances: HcmBalanceDto[];
}