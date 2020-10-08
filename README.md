# Simple webhooks server

A simple webhooks server to execute command when a url is requested.

## Example

```js
import { serve } from 'simple-webhooks-server';

serve({
  port: 4003,
  contextPath: '/example',
  logHooksToConsole: true,
  enableTaskStatusPage: true,
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
```
