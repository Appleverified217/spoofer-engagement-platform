const request = require('supertest');
const { app, server } = require('../src/server');

afterAll((done) => {
  if (server) {
    server.close(done);
  } else {
    done();
  }
});

describe('Follower Farming Platform API Tests', () => {
  test('GET /health should return status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body.status).toEqual('ok');
    expect(res.body.service).toEqual('follower-farming-backend');
  });

  test('GET /api/tasks/available should return array', async () => {
    const res = await request(app).get('/api/tasks/available');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
  });
});
