import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateTimeOffRequestDto } from './create-request.dto';

export class UpdateTimeOffRequestDto extends PartialType(CreateTimeOffRequestDto) {
  @ApiProperty({
    description: 'New status for the time-off request',
    enum: ['APPROVED', 'REJECTED', 'CANCELLED'],
    required: false,
    example: 'APPROVED',
  })
  @IsEnum(['APPROVED', 'REJECTED', 'CANCELLED'])
  @IsOptional()
  status?: 'APPROVED' | 'REJECTED' | 'CANCELLED';
}