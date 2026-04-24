import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffRequest } from './time-off.entity';
import { TimeOffService } from './time-off.service';
import { BalanceModule } from '../balance/balance.module';
import { HcmModule } from '../hcm/hcm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequest]),
    BalanceModule,
    HcmModule,
  ],
  providers: [TimeOffService],
  exports: [TimeOffService],
})
export class TimeOffModule {}