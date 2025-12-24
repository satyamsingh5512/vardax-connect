/**
 * Client example - Manual analysis
 */

const { createClient } = require('@vardax/connect');

const client = createClient('vardax://localhost:8000');

async function main() {
  // Check VARDAx status
  console.log('Checking VARDAx status...');
  const status = await client.getStatus();
  console.log('Connected:', status.connected);
  console.log('');

  // Analyze a request manually
  console.log('Analyzing request...');
  const analysis = await client.analyze({
    request_id: 'manual-test-123',
    timestamp: new Date().toISOString(),
    client_ip: '192.168.1.100',
    method: 'GET',
    uri: '/api/users',
    user_agent: 'Test Client'
  });

  console.log('Anomaly score:', analysis.score);
  console.log('Allowed:', analysis.allowed);
  console.log('Request ID:', analysis.requestId);
}

main().catch(console.error);
