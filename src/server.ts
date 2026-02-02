import { serve } from '@hono/node-server';
import { createServer } from 'http';
import app from './app';
import env from './env';

// Start server
const port = parseInt(env.PORT);
console.log(`Starting techstudio API server on port ${port}...`);

serve(
  {
    fetch: app.fetch,
    port,
    createServer,
  },
  (info) => {
    console.log(`✅ Server started on port ${info.port}`);
    console.log(`📚 API documentation: http://localhost:${info.port}/reference`);
    console.log(`🏥 Health check: http://localhost:${info.port}/health`);
    console.log(`📊 Queue stats: http://localhost:${info.port}/queue-stats`);
    console.log(`🔧 Test events: http://localhost:${info.port}/test-event`);

    console.log(`\n🔄 API Versioning Examples:`);
    console.log(
      `  Header:  curl -H "API-Version: 1.1" http://localhost:${info.port}/api/authentication/signin`
    );
    console.log(
      `  Query:   curl "http://localhost:${info.port}/api/authentication/signin?version=1.1"`
    );
    console.log(
      `  Accept:  curl -H "Accept: application/vnd.techstudio.v1+json" http://localhost:${info.port}/api/authentication/signin`
    );
    console.log(`  Path:    curl http://localhost:${info.port}/api/v1/authentication/signin`);

    console.log(`\n📖 API Version Info: http://localhost:${info.port}/api/version`);
    console.log(`📈 Metrics: http://localhost:${info.port}/metrics`);
  }
);
