// mock-hcm/server.js
const express = require('express');
const app = express();

app.use(express.json());

const PORT = 4000;

// In-memory balance store
let balances = {};

// Seed data: key = `${employeeId}:${locationId}`
const seedData = {
  'emp001:loc001': 10,
  'emp002:loc001': 5,
  'emp003:loc002': 0,
};

// Helper to reset balances to seed state
function resetBalances() {
  balances = {};
  for (const [key, days] of Object.entries(seedData)) {
    balances[key] = days;
  }
}
resetBalances(); // initial seed

// Helper to get balance record
function getBalanceRecord(employeeId, locationId) {
  const key = `${employeeId}:${locationId}`;
  const availableDays = balances[key];
  if (availableDays === undefined) return null;
  return { employeeId, locationId, availableDays };
}

// Middleware to log requests
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// 1. GET /hcm/balance
app.get('/hcm/balance', (req, res) => {
  const { employeeId, locationId } = req.query;
  if (!employeeId || !locationId) {
    return res.status(400).json({ error: 'Missing employeeId or locationId' });
  }
  const record = getBalanceRecord(employeeId, locationId);
  if (!record) {
    return res.status(404).json({ error: 'Balance record not found' });
  }
  res.json(record);
});

// 2. POST /hcm/time-off
app.post('/hcm/time-off', (req, res) => {
  const { employeeId, locationId, days } = req.body;

  // Validate required fields
  if (!employeeId || !locationId || days === undefined) {
    return res.status(400).json({ error: 'Missing required fields: employeeId, locationId, days' });
  }
  if (typeof days !== 'number' || days <= 0) {
    return res.status(400).json({ error: 'days must be a positive number' });
  }

  const key = `${employeeId}:${locationId}`;
  const current = balances[key];
  if (current === undefined) {
    return res.status(404).json({ error: 'Balance record not found' });
  }

  // 10% random failure simulation
  if (Math.random() < 0.1) {
    return res.status(500).json({ error: 'HCM internal error' });
  }

  if (current < days) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // Deduct days
  balances[key] = current - days;
  res.status(200).json({
    success: true,
    remainingBalance: balances[key],
  });
});

// 3. GET /hcm/balances/batch
app.get('/hcm/balances/batch', (req, res) => {
  const allBalances = Object.entries(balances).map(([key, availableDays]) => {
    const [employeeId, locationId] = key.split(':');
    return { employeeId, locationId, availableDays };
  });
  res.json(allBalances);
});

// 4. POST /hcm/anniversary-bonus
app.post('/hcm/anniversary-bonus', (req, res) => {
  const { employeeId, locationId, bonusDays } = req.body;
  if (!employeeId || !locationId || bonusDays === undefined) {
    return res.status(400).json({ error: 'Missing required fields: employeeId, locationId, bonusDays' });
  }
  if (typeof bonusDays !== 'number' || bonusDays <= 0) {
    return res.status(400).json({ error: 'bonusDays must be a positive number' });
  }

  const key = `${employeeId}:${locationId}`;
  if (balances[key] === undefined) {
    return res.status(404).json({ error: 'Balance record not found' });
  }

  balances[key] += bonusDays;
  res.json({
    employeeId,
    locationId,
    availableDays: balances[key],
  });
});

// 5. POST /hcm/reset - reset to seed data (for test teardown)
app.post('/hcm/reset', (req, res) => {
  resetBalances();
  res.json({ message: 'Balances reset to seed data' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Mock HCM server running on http://localhost:${PORT}`);
  console.log('Seed balances:');
  for (const [key, days] of Object.entries(seedData)) {
    const [emp, loc] = key.split(':');
    console.log(`  Employee ${emp}, Location ${loc}: ${days} days`);
  }
});