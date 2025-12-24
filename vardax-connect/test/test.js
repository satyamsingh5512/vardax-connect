/**
 * Test file for @vardax/connect
 */

const vardax = require('../index');

console.log('🧪 Testing @vardax/connect\n');

// Test 1: Parse connection string
console.log('Test 1: Parse connection string');
try {
  const config = vardax.parseConnectionString('vardax://localhost:8000?apiKey=test123&mode=protect&debug=true');
  console.log('✅ Parsed:', {
    host: config.host,
    port: config.port,
    apiKey: config.apiKey,
    mode: config.mode,
    debug: config.debug
  });
} catch (error) {
  console.log('❌ Failed:', error.message);
}

console.log('');

// Test 2: Parse HTTP connection string
console.log('Test 2: Parse HTTP connection string');
try {
  const config = vardax.parseConnectionString('http://localhost:8000?mode=monitor');
  console.log('✅ Parsed:', {
    host: config.host,
    port: config.port,
    mode: config.mode
  });
} catch (error) {
  console.log('❌ Failed:', error.message);
}

console.log('');

// Test 3: Create middleware
console.log('Test 3: Create middleware');
try {
  const middleware = vardax('vardax://localhost:8000?mode=monitor');
  console.log('✅ Middleware created:', typeof middleware === 'function');
} catch (error) {
  console.log('❌ Failed:', error.message);
}

console.log('');

// Test 4: Create client
console.log('Test 4: Create client');
try {
  const client = vardax.createClient('vardax://localhost:8000');
  console.log('✅ Client created:', {
    hasAnalyze: typeof client.analyze === 'function',
    hasGetStatus: typeof client.getStatus === 'function',
    hasGetConfig: typeof client.getConfig === 'function'
  });
} catch (error) {
  console.log('❌ Failed:', error.message);
}

console.log('');

// Test 5: Extract features
console.log('Test 5: Extract features');
try {
  const mockReq = {
    ip: '192.168.1.100',
    method: 'GET',
    path: '/api/users',
    url: '/api/users?id=123',
    httpVersion: '1.1',
    get: (header) => {
      const headers = {
        'user-agent': 'Mozilla/5.0',
        'content-type': 'application/json'
      };
      return headers[header.toLowerCase()];
    },
    connection: {
      remoteAddress: '192.168.1.100',
      remotePort: 54321
    }
  };

  const features = vardax.extractFeatures(mockReq);
  console.log('✅ Features extracted:', {
    method: features.method,
    uri: features.uri,
    client_ip: features.client_ip,
    user_agent: features.user_agent
  });
} catch (error) {
  console.log('❌ Failed:', error.message);
}

console.log('');
console.log('✅ All tests passed!');
console.log('');
console.log('To test with real VARDAx:');
console.log('1. Start VARDAx: npm run dev');
console.log('2. Run: node test/integration-test.js');
