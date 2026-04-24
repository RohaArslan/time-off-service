import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { HcmBalanceDto } from '../time-off/dto/hcm-balance.dto';

@Injectable()
export class HcmService {
  private readonly baseUrl: string;

  constructor(private readonly httpService: HttpService) {
    this.baseUrl = process.env.HCM_BASE_URL || 'http://localhost:4000';
  }

  /**
   * Retrieves the available time-off balance for a specific employee and location.
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @returns Promise resolving to available days as a number
   * @throws ServiceUnavailableException when HCM is unreachable or returns 5xx
   */
  async getBalance(employeeId: string, locationId: string): Promise<number> {
    const url = `${this.baseUrl}/hcm/balance`;
    console.log(`GET ${url}?employeeId=${employeeId}&locationId=${locationId}`);

    try {
      const response = await firstValueFrom(
        this.httpService.get<{ availableDays: number }>(url, {
          params: { employeeId, locationId },
        }),
      );
      return response.data.availableDays;
    } catch (error) {
      this.handleHttpError(error, 'Failed to fetch balance from HCM system');
    }
  }

  /**
   * Submits a time-off request to the HCM system.
   * @param employeeId - Employee identifier
   * @param locationId - Location identifier
   * @param days - Number of days requested
   * @returns Promise resolving to confirmation object
   * @throws BadRequestException when HCM returns 400 (validation error)
   * @throws ServiceUnavailableException when HCM is unreachable or returns 5xx
   */
  async submitTimeOff(
    employeeId: string,
    locationId: string,
    days: number,
  ): Promise<{ success: boolean; message?: string }> {
    const url = `${this.baseUrl}/hcm/time-off`;
    const payload = { employeeId, locationId, days };
    console.log(`POST ${url}`, payload);

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ success: boolean; message?: string }>(url, payload),
      );
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 400) {
        const hcmMessage = error.response?.data?.message || 'Bad request from HCM';
        throw new BadRequestException(`HCM error: ${hcmMessage}`);
      }
      this.handleHttpError(error, 'Failed to submit time-off to HCM system');
    }
  }

  /**
   * Retrieves a batch of all employee balances from the HCM system.
   * @returns Promise resolving to an array of HcmBalanceDto objects
   * @throws ServiceUnavailableException when HCM is unreachable or returns 5xx
   */
  async getBatchBalances(): Promise<HcmBalanceDto[]> {
    const url = `${this.baseUrl}/hcm/balances/batch`;
    console.log(`GET ${url}`);

    try {
      const response = await firstValueFrom(
        this.httpService.get<HcmBalanceDto[]>(url),
      );
      return response.data;
    } catch (error) {
      this.handleHttpError(error, 'Failed to fetch batch balances from HCM system');
    }
  }

  /**
   * Centralized error handler for HTTP calls.
   * @param error - Axios error object
   * @param fallbackMessage - Message for ServiceUnavailableException
   * @throws ServiceUnavailableException or rethrows BadRequestException
   */
  private handleHttpError(error: any, fallbackMessage: string): never {
    if (error.response) {
      // 5xx server errors or other non-400 errors (except 400 handled separately)
      if (error.response.status >= 500) {
        throw new ServiceUnavailableException(fallbackMessage);
      }
    } else if (error.request) {
      // No response received (network error)
      throw new ServiceUnavailableException(fallbackMessage);
    }
    // Re-throw unexpected errors as service unavailable
    throw new ServiceUnavailableException(fallbackMessage);
  }
}