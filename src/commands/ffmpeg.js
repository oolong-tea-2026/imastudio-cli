'use strict';

const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

module.exports = function registerFmPack(program) {
  program
    .command('ffmpeg')
    .description('Run ffmpeg (bundled static binary) — all arguments are passed through')
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .helpOption(false)
    .action((_opts, cmd) => {
      // Everything after "fm-pack" goes straight to ffmpeg
      const args = cmd.args;
      const child = spawn(ffmpegPath, args, {
        stdio: 'inherit',
      });
      child.on('error', (err) => {
        console.error(`Failed to start ffmpeg: ${err.message}`);
        process.exit(1);
      });
      child.on('close', (code) => {
        process.exit(code ?? 0);
      });
    });
};
