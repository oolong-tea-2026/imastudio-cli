#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const pkg = require('../package.json');

// Register commands
const registerListTaskTypes = require('../src/commands/list-task-types');
const registerListModels = require('../src/commands/list-models');
const registerModelInfo = require('../src/commands/model-info');
const registerUpload = require('../src/commands/upload');
const registerCreateTask = require('../src/commands/create-task');
const registerTaskStatus = require('../src/commands/task-status');
const registerInit = require('../src/commands/init');
const registerDoctor = require('../src/commands/doctor');
const registerFfmpeg = require('../src/commands/ffmpeg');
const registerFfprobe = require('../src/commands/ffprobe');

program
  .name('ima')
  .version(pkg.version)
  .description('IMA Studio CLI - AI content generation from the command line')
  .option('--api-key <key>', 'IMA API key (overrides config/env)')
  .option('--base-url <url>', 'API base URL (default: https://api.imastudio.com)')
  .option('--json', 'Output as JSON')
  .option('--no-color', 'Disable colored output');

registerInit(program);
registerListTaskTypes(program);
registerListModels(program);
registerModelInfo(program);
registerUpload(program);
registerCreateTask(program);
registerTaskStatus(program);
registerDoctor(program);
registerFfmpeg(program);
registerFfprobe(program);

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
