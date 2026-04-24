import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { TimeOffService } from './time-off.service';
import { TimeOffRequest } from './time-off.entity';
import { BalanceService } from '../balance/balance.service';
import { HcmService } from '../hcm/hcm.service';
import { CreateTimeOffRequestDto } from './dto/create-request.dto';
import { Balance } from '../balance/balance.entity';

describe('TimeOffService', () => {
  let service: TimeOffService;
  let balanceService: jest.Mocked<BalanceService>;
  let hcmService: jest.Mocked<HcmService>;
  let repository: jest.Mocked<any>;

  const mockBalance = { employeeId: 'emp001', locationId: 'loc001', availableDays: 10 } as Balance;
  const mockRequest = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    employeeId: 'emp001',
    locationId: 'loc001',
    startDate: '2025-07-10',
    endDate: '2025-07-12',
    daysRequested: 2,
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as TimeOffRequest;

  const createDto: CreateTimeOffRequestDto = {
    employeeId: 'emp001',
    locationId: 'loc001',
    startDate: '2025-07-10',
    endDate: '2025-07-12',
    daysRequested: 2,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeOffService,
        {
          provide: getRepositoryToken(TimeOffRequest),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: BalanceService,
          useValue: {
            getBalance: jest.fn(),
            deductBalance: jest.fn(),
            upsertBalance: jest.fn(),
            syncFromBatch: jest.fn(),
          },
        },
        {
          provide: HcmService,
          useValue: {
            getBalance: jest.fn(),
            submitTimeOff: jest.fn(),
            getBatchBalances: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TimeOffService>(TimeOffService);
    balanceService = module.get(BalanceService);
    hcmService = module.get(HcmService);
    repository = module.get(getRepositoryToken(TimeOffRequest));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('approves and deducts balance when HCM approves', async () => {
      balanceService.getBalance.mockResolvedValue(mockBalance);
      hcmService.submitTimeOff.mockResolvedValue({ success: true });
      balanceService.deductBalance.mockResolvedValue({ ...mockBalance, availableDays: 8 });
      repository.create.mockReturnValue(mockRequest);
      repository.save.mockResolvedValue({ ...mockRequest, status: 'APPROVED' });

      const result = await service.createRequest(createDto);

      expect(balanceService.getBalance).toHaveBeenCalledWith('emp001', 'loc001');
      expect(hcmService.submitTimeOff).toHaveBeenCalledWith('emp001', 'loc001', 2);
      expect(balanceService.deductBalance).toHaveBeenCalledWith('emp001', 'loc001', 2);
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result.status).toBe('APPROVED');
    });

    it('throws BadRequestException when local balance insufficient', async () => {
      balanceService.getBalance.mockResolvedValue({ ...mockBalance, availableDays: 1 });

      await expect(service.createRequest(createDto)).rejects.toThrow(BadRequestException);
      expect(balanceService.getBalance).toHaveBeenCalled();
      expect(hcmService.submitTimeOff).not.toHaveBeenCalled();
      expect(balanceService.deductBalance).not.toHaveBeenCalled();
    });

    it('saves as PENDING when HCM throws ServiceUnavailableException', async () => {
      balanceService.getBalance.mockResolvedValue(mockBalance);
      hcmService.submitTimeOff.mockRejectedValue(new ServiceUnavailableException());
      repository.create.mockReturnValue(mockRequest);
      repository.save.mockResolvedValue({ ...mockRequest, status: 'PENDING' });

      const result = await service.createRequest(createDto);

      expect(hcmService.submitTimeOff).toHaveBeenCalled();
      expect(balanceService.deductBalance).not.toHaveBeenCalled();
      expect(result.status).toBe('PENDING');
    });

    it('saves as REJECTED when HCM throws BadRequestException', async () => {
      balanceService.getBalance.mockResolvedValue(mockBalance);
      hcmService.submitTimeOff.mockRejectedValue(new BadRequestException('Insufficient in HCM'));
      repository.create.mockReturnValue(mockRequest);
      repository.save.mockResolvedValue({ ...mockRequest, status: 'REJECTED' });

      const result = await service.createRequest(createDto);

      expect(hcmService.submitTimeOff).toHaveBeenCalled();
      expect(balanceService.deductBalance).not.toHaveBeenCalled();
      expect(result.status).toBe('REJECTED');
    });
  });

  describe('getRequest', () => {
    it('throws NotFoundException when id not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.getRequest('non-existent')).rejects.toThrow(NotFoundException);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'non-existent' } });
    });

    it('returns request when found', async () => {
      repository.findOne.mockResolvedValue(mockRequest);
      const result = await service.getRequest(mockRequest.id);
      expect(result).toEqual(mockRequest);
    });
  });

  describe('cancelRequest', () => {
    it('restores balance when cancelling an APPROVED request', async () => {
      const approvedRequest = { ...mockRequest, status: 'APPROVED', daysRequested: 2 };
      repository.findOne.mockResolvedValue(approvedRequest);
      balanceService.getBalance.mockResolvedValue({ ...mockBalance, availableDays: 8 });
      balanceService.upsertBalance.mockResolvedValue({ ...mockBalance, availableDays: 10 });
      repository.save.mockResolvedValue({ ...approvedRequest, status: 'CANCELLED' });

      const result = await service.cancelRequest(approvedRequest.id);

      expect(balanceService.getBalance).toHaveBeenCalledWith('emp001', 'loc001');
      expect(balanceService.upsertBalance).toHaveBeenCalledWith('emp001', 'loc001', 10);
      expect(repository.save).toHaveBeenCalled();
      expect(result.status).toBe('CANCELLED');
    });

    it('throws BadRequestException when cancelling a REJECTED request', async () => {
      const rejectedRequest = { ...mockRequest, status: 'REJECTED' };
      repository.findOne.mockResolvedValue(rejectedRequest);

      await expect(service.cancelRequest(rejectedRequest.id)).rejects.toThrow(BadRequestException);
      expect(balanceService.getBalance).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('syncBalancesFromHcm', () => {
    it('calls getBatchBalances and syncFromBatch', async () => {
      const mockBatch = [
        { employeeId: 'emp001', locationId: 'loc001', availableDays: 10 },
      ];
      hcmService.getBatchBalances.mockResolvedValue(mockBatch);
      balanceService.syncFromBatch.mockResolvedValue(undefined);

      await service.syncBalancesFromHcm();

      expect(hcmService.getBatchBalances).toHaveBeenCalled();
      expect(balanceService.syncFromBatch).toHaveBeenCalledWith(mockBatch);
    });
  });
});