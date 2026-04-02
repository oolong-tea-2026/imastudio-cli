'use strict';

const { bold, cyan, dim, table: printTable } = require('../output');
const { TASK_TYPES } = require('../task-types');

module.exports = function registerListTaskTypes(program) {
  program
    .command('list-task-types')
    .description('List all supported task types (image/video/music generation)')
    .action((opts, cmd) => {
      const rootOpts = cmd.optsWithGlobals();

      if (rootOpts.json) {
        console.log(JSON.stringify(TASK_TYPES, null, 2));
        return;
      }

      console.log(`\n${bold('Supported Task Types')}\n`);
      printTable(
        TASK_TYPES.map((t) => [cyan(t.id), t.input, t.output, t.desc]),
        [bold('Task Type'), bold('Input'), bold('Output'), bold('Description')]
      );
      console.log();
    });
};
