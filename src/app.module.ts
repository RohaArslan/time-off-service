import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeOffModule } from './time-off/time-off.module';
import { TimeOffRequest } from './time-off/time-off.entity';
import { Balance } from './balance/balance.entity';

@Module({
  imports: [
    // Global configuration for environment variables
    ConfigModule.forRoot({ isGlobal: true }),
    // SQLite database configuration using better-sqlite3
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: process.env.DATABASE_PATH || 'timeoff.sqlite',
      entities: [TimeOffRequest, Balance],
      synchronize: true, // Auto-create schema (acceptable for this assessment)
    }),
    TimeOffModule,
  ],
})
export class AppModule {}