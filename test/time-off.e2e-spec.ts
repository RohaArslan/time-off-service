import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import nock from 'nock';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('TimeOffController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    nock.cleanAll();
  });

  beforeEach(() => {
    nock.cleanAll();
  });

  const baseUrl = 'http://localhost:4000';

  it('POST /time-off - creates request successfully (nock mocks HCM approval)', async () => {
    // Seed balance via direct DB? For e2e, we rely on sync or manual insert. Simpler: use sync endpoint first to seed.
    // But to keep test isolated, we can call POST /sync/hcm which pulls from mock HCM (which we'll nock).
    // First, nock the batch endpoint to return seed data.
    nock(baseUrl)
      .get('/hcm/balances/batch')
      .reply(200, [{ employeeId: 'emp001', locationId: 'loc001', availableDays: 10 }]);

    await request(app.getHttpServer())
      .post('/sync/hcm')
      .expect(200);

    // Now nock the time-off submission approval
    nock(baseUrl)
      .post('/hcm/time-off')
      .reply(200, { success: true, remainingBalance: 8 });

    const createDto = {
      employeeId: 'emp001',
      locationId: 'loc001',
      startDate: '2025-07-10',
      endDate: '2025-07-12',
      daysRequested: 2,
    };

    const response = await request(app.getHttpServer())
      .post('/time-off')
      .send(createDto)
      .expect(201);

    expect(response.body.status).toBe('APPROVED');
    expect(response.body.daysRequested).toBe(2);
  });

  it('POST /time-off - returns 400 when HCM rejects with insufficient balance', async () => {
    // Ensure balance exists and is low
    // Override balance via upsert? For simplicity, we can reset and set low.
    // But since we rely on HCM, nock the balance check. Actually our service first checks local balance.
    // So we need to set local balance low. Use sync to set.
    nock(baseUrl)
      .get('/hcm/balances/batch')
      .reply(200, [{ employeeId: 'emp001', locationId: 'loc001', availableDays: 1 }]);

    await request(app.getHttpServer())
      .post('/sync/hcm')
      .expect(200);

    const createDto = {
      employeeId: 'emp001',
      locationId: 'loc001',
      startDate: '2025-07-15',
      endDate: '2025-07-16',
      daysRequested: 2,
    };

    const response = await request(app.getHttpServer())
      .post('/time-off')
      .send(createDto)
      .expect(400);

    expect(response.body.message).toContain('Insufficient leave balance');
  });

  it('GET /time-off/:id - returns 404 for unknown id', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await request(app.getHttpServer())
      .get(`/time-off/${fakeId}`)
      .expect(404);
  });

  it('PATCH /time-off/:id/cancel - cancels an approved request', async () => {
    // First create an approved request (use same nock as first test)
    nock(baseUrl)
      .get('/hcm/balances/batch')
      .reply(200, [{ employeeId: 'emp001', locationId: 'loc001', availableDays: 10 }]);

    await request(app.getHttpServer())
      .post('/sync/hcm')
      .expect(200);

    nock(baseUrl)
      .post('/hcm/time-off')
      .reply(200, { success: true });

    const createRes = await request(app.getHttpServer())
      .post('/time-off')
      .send({
        employeeId: 'emp001',
        locationId: 'loc001',
        startDate: '2025-08-01',
        endDate: '2025-08-03',
        daysRequested: 2,
      })
      .expect(201);

    const requestId = createRes.body.id;

    const cancelRes = await request(app.getHttpServer())
      .patch(`/time-off/${requestId}/cancel`)
      .expect(200);

    expect(cancelRes.body.status).toBe('CANCELLED');

    // Verify balance restored (check balance endpoint)
    const balanceRes = await request(app.getHttpServer())
      .get('/balance/emp001/loc001')
      .expect(200);
    expect(balanceRes.body.availableDays).toBe(10); // original days restored
  });

  it('POST /sync/hcm - syncs balances from HCM batch endpoint', async () => {
    const mockBatch = [
      { employeeId: 'emp001', locationId: 'loc001', availableDays: 25 },
      { employeeId: 'emp002', locationId: 'loc001', availableDays: 12 },
    ];
    nock(baseUrl)
      .get('/hcm/balances/batch')
      .reply(200, mockBatch);

    const res = await request(app.getHttpServer())
      .post('/sync/hcm')
      .expect(200);

    expect(res.body.message).toContain('Balance synchronization from HCM completed');

    // Verify one of them
    const balanceRes = await request(app.getHttpServer())
      .get('/balance/emp001/loc001')
      .expect(200);
    expect(balanceRes.body.availableDays).toBe(25);
  });

  it('GET /balance/:employeeId/:locationId - returns current balance', async () => {
    nock(baseUrl)
      .get('/hcm/balances/batch')
      .reply(200, [{ employeeId: 'emp001', locationId: 'loc001', availableDays: 7 }]);

    await request(app.getHttpServer())
      .post('/sync/hcm')
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/balance/emp001/loc001')
      .expect(200);

    expect(res.body.availableDays).toBe(7);
    expect(res.body.employeeId).toBe('emp001');
  });
});