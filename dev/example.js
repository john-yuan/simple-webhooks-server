const { serve } = require('../dist/server');

serve({
  port: 4003,
  contextPath: '/example',
  hooks: [
    // (GET or POST) http://localhost:4003/example/hooks/hello/hello-secret
    {
      name: 'hello',
      secret: 'hello-secret',
      command: 'echo hello',
    },
    // (POST only) http://localhost:4003/example/hooks/sleep/sleep-secret
    {
      name: 'sleep',
      secret: 'sleep-secret',
      command: 'sleep 3 && date',
      postOnly: true
    }
  ]
});
