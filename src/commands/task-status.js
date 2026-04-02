'use strict';

const { requireApiKey, getBaseUrl } = require('../config');
const { ImaClient } = require('../api');
const { bold, cyan, dim, green, yellow, red, spinner, handleError } = require('../output');

module.exports = function registerTaskStatus(program) {
  program
    .command('task-status')
    .description('Check the status of a generation task')
    .argument('<task-id>', 'Task ID')
    .option('--wait', 'Wait for task to complete')
    .option('--poll-interval <seconds>', 'Polling interval (default: 5)', '5')
    .option('--timeout <seconds>', 'Max wait time (default: 300)', '300')
    .action(async (taskId, opts, cmd) => {
      const rootOpts = cmd.optsWithGlobals();

      try {
        const apiKey = requireApiKey(rootOpts);
        const baseUrl = getBaseUrl(rootOpts);
        const client = new ImaClient(apiKey, baseUrl);

        const task = await client.getTaskDetail(taskId);

        if (!opts.wait) {
          if (rootOpts.json) {
            console.log(JSON.stringify(task, null, 2));
            return;
          }

          printTaskStatus(task);
          return;
        }

        // Poll mode
        const interval = parseInt(opts.pollInterval, 10) * 1000;
        const timeout = parseInt(opts.timeout, 10) * 1000;
        const start = Date.now();
        const spin = spinner('Waiting for result...');

        let currentTask = task;
        while (Date.now() - start < timeout) {
          const medias = currentTask.medias || [];

          if (currentTask.status === 'failed' || medias.some((m) => (m.resource_status ?? 0) === 2)) {
            spin.stop(`${red('✗')} Task failed`);
            if (rootOpts.json) console.log(JSON.stringify(currentTask, null, 2));
            else printTaskStatus(currentTask);
            process.exit(1);
          }

          const allDone = medias.length > 0 && medias.every((m) => (m.resource_status ?? 0) === 1 && m.url);
          if (allDone) {
            spin.stop(`${green('✓')} Complete!`);
            if (rootOpts.json) console.log(JSON.stringify(currentTask, null, 2));
            else printTaskStatus(currentTask);
            return;
          }

          const elapsed = Math.round((Date.now() - start) / 1000);
          spin.update(`Waiting... ${elapsed}s`);
          await sleep(interval);
          currentTask = await client.getTaskDetail(taskId);
        }

        spin.stop(`${yellow('⚠')} Timeout`);
        printTaskStatus(currentTask);
        process.exit(2);
      } catch (err) {
        handleError(err);
      }
    });
};

function printTaskStatus(task) {
  const statusIcon = {
    success: green('✓'),
    completed: green('✓'),
    failed: red('✗'),
    processing: yellow('⏳'),
    pending: yellow('⏳'),
  };

  console.log(`\n${bold('Task')} ${cyan(task.id)}\n`);
  console.log(`  Type:    ${task.task_type}`);
  console.log(`  Prompt:  ${dim(truncate(task.prompt || '', 80))}`);

  const medias = task.medias || [];
  for (let i = 0; i < medias.length; i++) {
    const m = medias[i];
    const status = m.status || (m.resource_status === 1 ? 'success' : 'processing');
    const icon = statusIcon[status] || yellow('?');
    console.log(`\n  ${bold(`Output ${i + 1}:`)} ${icon} ${status}`);
    console.log(`    Model: ${m.mode_name || m.model_id}`);
    if (m.url) console.log(`    URL:   ${cyan(m.url)}`);
    if (m.width && m.height) console.log(`    Size:  ${m.width}×${m.height}`);
  }
  console.log();
}

function truncate(s, max) {
  return s.length > max ? s.substring(0, max) + '…' : s;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
