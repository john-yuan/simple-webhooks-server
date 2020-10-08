import moment from 'moment';
import express from 'express';
import path from 'path';
import { toString, isNil } from 'lodash/fp';
import { exec } from 'child_process';

interface Hook {
  name: string;
  secret: string;
  command: string;
  comment?: string;
  postOnly?: boolean;
}

interface Config {
  port?: number;
  host?: string;
  hooks?: Hook[];
  maxHistoryCount?: number;
  contextPath?: string;
  publicHostName?: string;
  enableTaskStatusPage?: boolean;
  logHooksToConsole?: boolean;
}

interface Task {
  buildId: number;
  hook: Hook;
  force?: boolean;
  trigger?: string;
  createdAt?: string;
  startedAt?: string;
  finishedAt?: string;
  reuseResultOf?: number;
  error?: {
    code?: number;
    signal?: string;
  };
  stdout?: string;
  stderr?: string;
}

export function serve(config: Config) {
  return new Promise<void>((resolve) => {
    const {
      port = 4003,
      host = '0.0.0.0',
      hooks = [],
      maxHistoryCount = 200,
      contextPath,
      publicHostName,
      enableTaskStatusPage,
      logHooksToConsole,
    } = config;

    const app = express();

    app.set('views', path.resolve(__dirname, '../views'));
    app.set('view engine', 'ejs');

    const waitingTasks: Task[] = [];
    const finishedTasks: Task[] = [];
    const baseUrl = isNil(contextPath) ? '' : toString(contextPath);

    let nextBuildId = 1;
    let buildingTask: Task | undefined = undefined;

    const now = () => moment().toISOString(true);

    const build = (task: Task) => new Promise((resolve) => {
      const { reuseResultOf, hook: { command } } = task;

      task.startedAt = now();

      if (isNil(reuseResultOf)) {
        exec(command, (error, stdout, stderr) => {
          task.finishedAt = now();
          task.stdout = toString(stdout);
          task.stderr = toString(stderr);
          task.error = error
            ? { code: error.code, signal: error.signal }
            : undefined;

          resolve();
        });
      } else {
        task.finishedAt = now();
        resolve();
      }
    });

    const notify = () => {
      if (!buildingTask) {
        var task = waitingTasks.shift();
        if (task) {
          buildingTask = task;
          build(task).finally(() => {
            if (task) {
              finishedTasks.push(task);
              if (finishedTasks.length > maxHistoryCount) {
                finishedTasks.shift();
              }
              console.log();
              console.log('          Id: ' + task.buildId);
              console.log('        Name: ' + task.hook.name);
              console.log('     Command: ' + task.hook.command);
              console.log('       Force: ' + (!!task.force));
              console.log('     Trigger: ' + (task.trigger || null));
              console.log('   Same with: ' + (task.reuseResultOf || null));
              console.log('  Created At: ' + task.createdAt);
              console.log('  Started At: ' + task.startedAt);
              console.log(' Finished At: ' + task.finishedAt);
              console.log('       Error: ' + (task.error ? task.error.code : null));
              console.log('      Stdout: ');
              task.stdout && console.log(toString(task.stdout).trim());
              console.log('      Stderr: ');
              task.stderr && console.log(toString(task.stderr).trim());
            }
            buildingTask = undefined;
            notify();
          });
        }
      }
    };

    const create = (task: Task) => {
      const existing = task.force ? null : waitingTasks.find(({
        reuseResultOf,
        hook: { name, command }
      }) => (
        isNil(reuseResultOf)
        && name === task.hook.name
        && command === task.hook.command
      ));

      task.createdAt = now();
      task.reuseResultOf = existing ? existing.buildId : undefined;

      waitingTasks.push(task);

      notify();
    };

    app.all(`${baseUrl}/hooks/:name/:secret`, (req, res) => {
      const { name, secret } =  req.params;
      const { trigger, force } = req.query;
      const hook = hooks.find((e) => {
        return e.name === name && e.secret === secret;
      });

      res.end();

      if (hook) {
        const { postOnly } = hook;
        const method = toString(req.method).toUpperCase();

        let shouldCreate = false;

        if (postOnly) {
          shouldCreate = method === 'POST';
        } else {
          shouldCreate = method === 'GET' || method === 'POST';
        }

        if (shouldCreate) {
          create({
            buildId: nextBuildId++,
            hook: { ...hook },
            force: !isNil(force),
            trigger: trigger ? toString(trigger) : undefined,
          });
        } else {
          console.log(`Ignore ${req.method} ${req.originalUrl}`);
          console.log();
        }
      }
    });

    if (enableTaskStatusPage) {
      app.get(`${baseUrl}/task_status`, (req, res) => {
        const waiting = [...waitingTasks];
        const finished = [...finishedTasks];
        const tasks = [...waiting.reverse()];
        if (buildingTask) {
          tasks.push(buildingTask);
        }
        res.render('task_status', {
          baseUrl,
          moment,
          tasks: [...tasks, ...finished.reverse()]
        });
      });

      app.use(`${baseUrl}/static`,
        express.static(path.resolve(__dirname, '../static')));
    }

    app.listen(port, host, () => {

      const address = toString(host).trim() === '0.0.0.0'
        ? `http://localhost:${port}`
        : `http://${host}:${port}`;

      if (logHooksToConsole) {
        console.log();
        if (hooks.length) {
          console.log('Hooks:');
          const hostName = publicHostName ? publicHostName : address;
          hooks.forEach(({ name, secret }) => {
            console.log(` - ${hostName}${baseUrl}/hooks/${name}/${secret}`);
          });
        } else {
          console.log('No hooks');
        }
      }

      console.log();
      console.log('Address:');
      console.log(` - ${address}${baseUrl}${enableTaskStatusPage ? '/task_status' : ''}`)
      console.log();

      resolve();
    });
  });
}
