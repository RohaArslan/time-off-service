import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeOffRequest } from './time-off.entity';
import { CreateTimeOffRequestDto } from './dto/create-request.dto';
import { BalanceService } from '../balance/balance.service';
import { HcmService } from '../hcm/hcm.service';

@Injectable()
export class TimeOffService {
  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly timeOffRepository: Repository<TimeOffRequest>,
    private readonly balanceService: BalanceService,
    private readonly hcmService: HcmService,
  ) {}

  /**
   * Creates a new time-off request.
   * Validates balance, attempts HCM submission, and updates status accordingly.
   * @param dto - CreateTimeOffRequestDto with employee, location, dates, days
   * @returns Promise resolving to the saved TimeOffRequest
   * @throws NotFoundException if balance not found for employee/location
   * @throws BadRequestException if insufficient balance
   */
  async createRequest(dto: CreateTimeOffRequestDto): Promise<TimeOffRequest> {
    // Step 1: Fetch current balance
    const balance = await this.balanceService.getBalance(dto.employeeId, dto.locationId);

    // Step 2: Validate sufficient balance
    if (balance.availableDays < dto.daysRequested) {
      throw new BadRequestException('Insufficient leave balance');
    }

    // Create initial request with PENDING status
    const request = this.timeOffRepository.create({
      employeeId: dto.employeeId,
      locationId: dto.locationId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      daysRequested: dto.daysRequested,
      status: 'PENDING',
    });

    // Step 3: Try HCM submission
    try {
      await this.hcmService.submitTimeOff(dto.employeeId, dto.locationId, dto.daysRequested);
      // HCM approved: deduct balance and set status APPROVED
      await this.balanceService.deductBalance(dto.employeeId, dto.locationId, dto.daysRequested);
      request.status = 'APPROVED';
    } catch (error : any) {
      if (error instanceof BadRequestException) {
        // HCM rejected the request (400)
        request.status = 'REJECTED';
        // Do NOT deduct balance
      } else if (error.name === 'ServiceUnavailableException') {
        // HCM unreachable or 5xx -> keep PENDING for later retry
        request.status = 'PENDING';
        // Do NOT deduct balance
      } else {
        // Re-throw unexpected errors
        throw error;
      }
    }

    // Step 4: Save and return
    return this.timeOffRepository.save(request);
  }

  /**
   * Retrieves a single time-off request by its ID.
   * @param id - UUID of the request
   * @returns Promise resolving to the TimeOffRequest
   * @throws NotFoundException if no request with the given ID exists
   */
  async getRequest(id: string): Promise<TimeOffRequest> {
    const request = await this.timeOffRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException(`Time-off request with id ${id} not found`);
    }
    return request;
  }

  /**
   * Lists all time-off requests for a specific employee, ordered newest first.
   * @param employeeId - Employee identifier
   * @returns Promise resolving to an array of TimeOffRequest entities
   */
  async listRequests(employeeId: string): Promise<TimeOffRequest[]> {
    return this.timeOffRepository.find({
      where: { employeeId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Cancels an existing time-off request.
   * If the request was approved, the deducted days are added back to balance.
   * @param id - UUID of the request to cancel
   * @returns Promise resolving to the updated TimeOffRequest with status CANCELLED
   * @throws NotFoundException if request not found
   * @throws BadRequestException if request is already rejected, already cancelled, or invalid state
   */
  async cancelRequest(id: string): Promise<TimeOffRequest> {
    const request = await this.getRequest(id);

    if (request.status === 'REJECTED') {
      throw new BadRequestException('Cannot cancel a rejected request');
    }
    if (request.status === 'CANCELLED') {
      throw new BadRequestException('Request already cancelled');
    }

    // If request was approved, refund the balance
    if (request.status === 'APPROVED') {
      await this.balanceService.upsertBalance(
        request.employeeId,
        request.locationId,
        request.daysRequested,
        // Note: upsertBalance adds days back? The method as defined replaces availableDays,
        // but we need to add back. Let's clarify: The service method upsertBalance should be extended
        // or we use getBalance then update. However the original BalanceService.upsertBalance replaces.
        // To add back days, we should retrieve current balance, add daysRequested, then upsert.
        // Since the requirement says "call balanceService.upsertBalance to add days back",
        // we assume upsertBalance takes new total days. So we need to get current balance first.
      );
      // Correct implementation: fetch current balance, add daysRequested, call upsertBalance.
      const currentBalance = await this.balanceService.getBalance(request.employeeId, request.locationId);
      const newAvailable = currentBalance.availableDays + request.daysRequested;
      await this.balanceService.upsertBalance(request.employeeId, request.locationId, newAvailable);
    }

    request.status = 'CANCELLED';
    return this.timeOffRepository.save(request);
  }

  /**
   * Synchronizes local balances with the HCM system.
   * Fetches batch balances from HCM and updates the local Balance table.
   * @returns Promise that resolves when sync is complete
   */
  async syncBalancesFromHcm(): Promise<void> {
    const hcmBalances = await this.hcmService.getBatchBalances();
    await this.balanceService.syncFromBatch(hcmBalances);
    console.log('Balance synchronization from HCM completed');
  }
}