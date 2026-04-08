'use strict';

const { spawn } = require('child_process');
const ffprobeStatic = require('ffprobe-static');

const ffprobePath = typeof ffprobeStatic === 'string' ? ffprobeStatic : ffprobeStatic.path;

module.exports = function registerFmProbe(program) {
  program
    .command('fm-probe')
    .description('Run ffprobe (bundled static binary) — all arguments are passed through')
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .helpOption(false)
    .action((_opts, cmd) => {
      // Everything after "fm-probe" goes straight to ffprobe
      const args = cmd.args;
      const child = spawn(ffprobePath, args, {
        stdio: 'inherit',
      });
      child.on('error', (err) => {
        console.error(`Failed to start ffprobe: ${err.message}`);
        process.exit(1);
      });
      child.on('close', (code) => {
        process.exit(code ?? 0);
      });
    });
};
