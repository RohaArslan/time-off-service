import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { Balance } from './balance.entity';
import { HcmBalanceDto } from '../time-off/dto/hcm-balance.dto';

describe('BalanceService', () => {
  let service: BalanceService;
  let repository: jest.Mocked<any>;

  const mockBalance: Balance = {
    id: 'balance-123',
    employeeId: 'emp001',
    locationId: 'loc001',
    availableDays: 10,
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        {
          provide: getRepositoryToken(Balance),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    repository = module.get(getRepositoryToken(Balance));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('returns balance when found', async () => {
      repository.findOne.mockResolvedValue(mockBalance);
      const result = await service.getBalance('emp001', 'loc001');
      expect(result).toEqual(mockBalance);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { employeeId: 'emp001', locationId: 'loc001' },
      });
    });

    it('throws NotFoundException when not found', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.getBalance('emp999', 'loc999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deductBalance', () => {
    it('throws BadRequestException when availableDays insufficient', async () => {
      repository.findOne.mockResolvedValue({ ...mockBalance, availableDays: 2 });
      await expect(service.deductBalance('emp001', 'loc001', 5)).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('deducts correctly when balance sufficient', async () => {
      repository.findOne.mockResolvedValue(mockBalance);
      repository.save.mockResolvedValue({ ...mockBalance, availableDays: 8, lastSyncedAt: expect.any(Date) });

      const result = await service.deductBalance('emp001', 'loc001', 2);
      expect(result.availableDays).toBe(8);
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('upsertBalance', () => {
    it('creates new record when not found', async () => {
      repository.findOne.mockResolvedValue(null);
      const newBalance = { employeeId: 'emp001', locationId: 'loc001', availableDays: 12 };
      repository.create.mockReturnValue(newBalance);
      repository.save.mockResolvedValue({ ...newBalance, id: 'new-id' });

      const result = await service.upsertBalance('emp001', 'loc001', 12);
      expect(repository.create).toHaveBeenCalledWith({
        employeeId: 'emp001',
        locationId: 'loc001',
        availableDays: 12,
        lastSyncedAt: expect.any(Date),
      });
      expect(repository.save).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });

    it('updates existing record when found', async () => {
      const existing = { ...mockBalance, availableDays: 5 };
      repository.findOne.mockResolvedValue(existing);
      repository.save.mockResolvedValue({ ...existing, availableDays: 15, lastSyncedAt: expect.any(Date) });

      const result = await service.upsertBalance('emp001', 'loc001', 15);
      expect(result.availableDays).toBe(15);
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('syncFromBatch', () => {
    it('calls upsertBalance for each item in array', async () => {
      const batch: HcmBalanceDto[] = [
        { employeeId: 'emp001', locationId: 'loc001', availableDays: 20 },
        { employeeId: 'emp002', locationId: 'loc001', availableDays: 8 },
      ];
      jest.spyOn(service, 'upsertBalance').mockResolvedValue({} as Balance);

      await service.syncFromBatch(batch);
      expect(service.upsertBalance).toHaveBeenCalledTimes(2);
      expect(service.upsertBalance).toHaveBeenCalledWith('emp001', 'loc001', 20);
      expect(service.upsertBalance).toHaveBeenCalledWith('emp002', 'loc001', 8);
    });
  });
});