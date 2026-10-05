// tests/load/ws-broadcast.js
// k6 load test: WS event fan-out to 100 subscribers must arrive in < 500 ms.
// Run: k6 run tests/load/ws-broadcast.js -e WS_URL=ws://localhost:3000 -e TOKEN=<jwt> -e BOARD_ID=<id>
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

export const options = {
  vus: 100,
  duration: '30s',
  thresholds: {
    'ws_fan_out_ms': ['p(95)<500'],
    'checks': ['rate>0.95'],
  },
};

const wsFanOutMs = new Trend('ws_fan_out_ms', true);

export default function () {
  const wsUrl = __ENV.WS_URL || 'ws://localhost:3000';
  const token = __ENV.TOKEN || '';
  const boardId = __ENV.BOARD_ID || 'test-board';

  const url = `${wsUrl}/api/v1/ws?boardId=${boardId}&token=${token}`;

  const response = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'subscribe', boardId }));
    });

    socket.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.sentAt) {
          const delay = Date.now() - msg.sentAt;
          wsFanOutMs.add(delay);
          check(msg, { 'fan-out < 500 ms': () => delay < 500 });
        }
      } catch {
        // ignore non-JSON messages
      }
    });

    socket.on('error', (e) => {
      console.error('WS error:', e);
    });

    // Keep connection open for 5 seconds per VU iteration.
    sleep(5);
    socket.close();
  });

  check(response, { 'WS connection established': (r) => r && r.status === 101 });
}
