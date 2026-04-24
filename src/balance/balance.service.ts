import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Balance } from './balance.entity';
import { HcmBalanceDto } from '../time-off/dto/hcm-balance.dto';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private readonly balanceRepository: Repository<Balance>,
  ) {}

  /**
   * Retrieves the balance record for a specific employee and location.
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @returns Promise resolving to the Balance entity
   * @throws NotFoundException if no balance exists for the employee-location pair
   */
  async getBalance(employeeId: string, locationId: string): Promise<Balance> {
    const balance = await this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });

    if (!balance) {
      throw new NotFoundException(`Balance not found for employee ${employeeId} at location ${locationId}`);
    }

    return balance;
  }

  /**
   * Creates or updates a balance record for an employee and location.
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param availableDays - New available days value
   * @returns Promise resolving to the saved Balance entity
   */
  async upsertBalance(
    employeeId: string,
    locationId: string,
    availableDays: number,
  ): Promise<Balance> {
    let balance = await this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });

    if (balance) {
      balance.availableDays = availableDays;
      balance.lastSyncedAt = new Date();
    } else {
      balance = this.balanceRepository.create({
        employeeId,
        locationId,
        availableDays,
        lastSyncedAt: new Date(),
      });
    }

    return this.balanceRepository.save(balance);
  }

  /**
   * Deducts a specified number of days from the employee's available balance.
   * Checks for sufficient balance before deducting.
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param days - Number of days to deduct (must be positive)
   * @returns Promise resolving to the updated Balance entity
   * @throws BadRequestException if available days are less than requested days
   * @throws NotFoundException if balance does not exist
   */
  async deductBalance(
    employeeId: string,
    locationId: string,
    days: number,
  ): Promise<Balance> {
    const balance = await this.getBalance(employeeId, locationId);

    if (balance.availableDays < days) {
      throw new BadRequestException(
        `Insufficient leave balance. Available: ${balance.availableDays}, Requested: ${days}`,
      );
    }

    balance.availableDays -= days;
    balance.lastSyncedAt = new Date();

    return this.balanceRepository.save(balance);
  }

  /**
   * Synchronizes a batch of balances from the HCM system.
   * Upserts each balance record and logs the total number processed.
   * @param balances - Array of HCM balance DTOs
   * @returns Promise that resolves when all records are synced
   */
  async syncFromBatch(balances: HcmBalanceDto[]): Promise<void> {
    let syncedCount = 0;

    for (const balance of balances) {
      await this.upsertBalance(balance.employeeId, balance.locationId, balance.availableDays);
      syncedCount++;
    }

    console.log(`Balance sync completed. ${syncedCount} record(s) synced.`);
  }
}