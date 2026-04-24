import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TimeOffService } from './time-off.service';
import { BalanceService } from '../balance/balance.service';
import { CreateTimeOffRequestDto } from './dto/create-request.dto';
import { HcmSyncPayloadDto } from './dto/hcm-sync-payload.dto';
import { TimeOffRequest } from './time-off.entity';
import { Balance } from '../balance/balance.entity';

@ApiTags('time-off')
@Controller()
export class TimeOffController {
  constructor(
    private readonly timeOffService: TimeOffService,
    private readonly balanceService: BalanceService,
  ) {}

  @Post('time-off')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new time-off request' })
  @ApiResponse({ status: 201, description: 'Request created successfully', type: TimeOffRequest })
  @ApiResponse({ status: 400, description: 'Insufficient balance or invalid input' })
  @ApiResponse({ status: 404, description: 'Balance not found for employee/location' })
  async createRequest(@Body(ValidationPipe) dto: CreateTimeOffRequestDto): Promise<TimeOffRequest> {
    return this.timeOffService.createRequest(dto);
  }

  @Get('time-off/:id')
  @ApiOperation({ summary: 'Get a single time-off request by ID' })
  @ApiParam({ name: 'id', description: 'UUID of the request' })
  @ApiResponse({ status: 200, description: 'Request found', type: TimeOffRequest })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async getRequest(@Param('id') id: string): Promise<TimeOffRequest> {
    return this.timeOffService.getRequest(id);
  }

  @Get('time-off')
  @ApiOperation({ summary: 'List all time-off requests for an employee' })
  @ApiQuery({ name: 'employeeId', required: true, description: 'Employee identifier' })
  @ApiResponse({ status: 200, description: 'List of requests', type: [TimeOffRequest] })
  async listRequests(@Query('employeeId') employeeId: string): Promise<TimeOffRequest[]> {
    return this.timeOffService.listRequests(employeeId);
  }

  @Patch('time-off/:id/cancel')
  @ApiOperation({ summary: 'Cancel an existing time-off request' })
  @ApiParam({ name: 'id', description: 'UUID of the request to cancel' })
  @ApiResponse({ status: 200, description: 'Request cancelled successfully', type: TimeOffRequest })
  @ApiResponse({ status: 400, description: 'Cannot cancel rejected or already cancelled request' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async cancelRequest(@Param('id') id: string): Promise<TimeOffRequest> {
    return this.timeOffService.cancelRequest(id);
  }

  @Get('balance/:employeeId/:locationId')
  @ApiOperation({ summary: 'Get current available balance for an employee and location' })
  @ApiParam({ name: 'employeeId', description: 'Employee identifier' })
  @ApiParam({ name: 'locationId', description: 'Location identifier' })
  @ApiResponse({ status: 200, description: 'Balance found', type: Balance })
  @ApiResponse({ status: 404, description: 'Balance not found' })
  async getBalance(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ): Promise<Balance> {
    return this.balanceService.getBalance(employeeId, locationId);
  }

  @Post('sync/hcm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger manual sync from HCM (pull batch balances)' })
  @ApiResponse({ status: 200, description: 'Sync triggered successfully' })
  @ApiResponse({ status: 503, description: 'HCM service unavailable' })
  async syncBalancesFromHcm(): Promise<{ message: string }> {
    await this.timeOffService.syncBalancesFromHcm();
    return { message: 'Balance synchronization from HCM completed' };
  }

  @Post('sync/batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive batch balance update from HCM (push)' })
  @ApiResponse({ status: 200, description: 'Batch processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  async receiveBatchSync(@Body(ValidationPipe) dto: HcmSyncPayloadDto): Promise<{ message: string }> {
    await this.balanceService.syncFromBatch(dto.balances);
    return { message: `Batch sync completed. ${dto.balances.length} record(s) processed.` };
  }
}