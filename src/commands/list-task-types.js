'use strict';

const { green, bold, cyan, dim, table: printTable } = require('../output');

// Hardcoded for now; will be fetched from cloud endpoint later
const TASK_TYPES = [
  { id: 'text_to_image', name: 'Text to Image', desc: 'Generate images from text prompts' },
  { id: 'image_to_image', name: 'Image to Image', desc: 'Transform images with text guidance' },
  { id: 'text_to_video', name: 'Text to Video', desc: 'Generate videos from text prompts' },
  { id: 'image_to_video', name: 'Image to Video', desc: 'Animate images into videos' },
  { id: 'text_to_music', name: 'Text to Music', desc: 'Generate music from text descriptions' },
  { id: 'lyrics_to_song', name: 'Lyrics to Song', desc: 'Generate songs from lyrics' },
];

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
        TASK_TYPES.map((t) => [cyan(t.id), t.name, dim(t.desc)]),
        [bold('ID'), bold('Name'), bold('Description')]
      );
      console.log();
    });
};
