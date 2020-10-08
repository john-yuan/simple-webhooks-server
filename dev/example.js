const { serve } = require('../dist/server');

serve({
  port: 4003,
  contextPath: '/example',
  logHooksToConsole: true,
  enableTaskStatusPage: true,
  hooks: [
    {
      name: 'hello',
      secret: 'hello-secret',
      command: 'echo hello',
    },
    {
      name: 'sleep',
      secret: 'sleep-secret',
      command: 'sleep 5',
    },
    {
      name: 'bad',
      secret: 'bad-secret',
      command: '/dev/null/notfound',
    }
  ]
});
