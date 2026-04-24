import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Balance } from './balance.entity';
import { BalanceService } from './balance.service';

@Module({
  imports: [TypeOrmModule.forFeature([Balance])],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}