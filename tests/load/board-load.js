// tests/load/board-load.js
// k6 load test: 1000-card board GET must complete in < 2 s at 50 concurrent users.
// Run: k6 run tests/load/board-load.js -e BASE_URL=http://localhost:3000 -e BOARD_ID=<id> -e TOKEN=<jwt>
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95th percentile < 2 s
    http_req_failed: ['rate<0.01'],    // < 1 % error rate
  },
};

const boardLoadDuration = new Trend('board_load_duration', true);

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
  const boardId = __ENV.BOARD_ID || 'test-board';
  const token = __ENV.TOKEN || '';

  const res = http.get(`${baseUrl}/api/v1/boards/${boardId}/cards`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  boardLoadDuration.add(res.timings.duration);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2000 ms': (r) => r.timings.duration < 2000,
  });

  sleep(0.5);
}
