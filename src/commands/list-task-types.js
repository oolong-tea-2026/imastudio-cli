'use strict';

const { green, bold, cyan, dim, table: printTable } = require('../output');

// Source of truth: ima-all-ai/scripts/ima_create.py POLL_CONFIG keys
// Will be fetched from cloud endpoint later
const TASK_TYPES = [
  { id: 'text_to_image',              name: 'Text to Image',              desc: 'Generate images from text prompts',           input: 'text' },
  { id: 'image_to_image',             name: 'Image to Image',             desc: 'Transform images with text guidance',         input: 'text + image' },
  { id: 'text_to_video',              name: 'Text to Video',              desc: 'Generate videos from text prompts',           input: 'text' },
  { id: 'image_to_video',             name: 'Image to Video',             desc: 'Animate images into videos',                  input: 'text + image' },
  { id: 'first_last_frame_to_video',  name: 'First/Last Frame to Video',  desc: 'Generate video from first and last frames',   input: 'text + 2 images' },
  { id: 'reference_image_to_video',   name: 'Reference Image to Video',   desc: 'Generate video with character/style reference', input: 'text + image' },
  { id: 'text_to_music',              name: 'Text to Music',              desc: 'Generate music from text descriptions',       input: 'text' },
  { id: 'text_to_speech',             name: 'Text to Speech',             desc: 'Convert text to speech audio',                input: 'text' },
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
        TASK_TYPES.map((t) => [cyan(t.id), t.name, dim(t.input), dim(t.desc)]),
        [bold('ID'), bold('Name'), bold('Input'), bold('Description')]
      );
      console.log();
    });
};
