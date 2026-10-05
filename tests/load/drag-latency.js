// tests/load/drag-latency.js
// k6 load test: card move round-trip must complete in < 500 ms at 20 concurrent users.
// Run: k6 run tests/load/drag-latency.js -e BASE_URL=http://localhost:3000 -e TOKEN=<jwt>
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

export const options = {
  vus: 20,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95th percentile < 500 ms
    http_req_failed: ['rate<0.01'],
  },
};

const dragLatency = new Trend('drag_latency_ms', true);

export default function () {
  const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
  const token = __ENV.TOKEN || '';
  const cardId = __ENV.CARD_ID || 'test-card';
  const targetListId = __ENV.TARGET_LIST_ID || 'target-list';

  const payload = JSON.stringify({ listId: targetListId, position: 1 });

  const res = http.patch(`${baseUrl}/api/v1/cards/${cardId}/move`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  dragLatency.add(res.timings.duration);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'round-trip < 500 ms': (r) => r.timings.duration < 500,
  });

  sleep(0.2);
}
