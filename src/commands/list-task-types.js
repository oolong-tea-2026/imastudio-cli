'use strict';

const { green, bold, cyan, dim, table: printTable } = require('../output');

// Source of truth: ima-all-ai/scripts/ima_create.py POLL_CONFIG keys
// Will be fetched from cloud endpoint later
const TASK_TYPES = [
  {
    id: 'text_to_image',
    name: 'Text to Image',
    input: 'prompt',
    output: 'image',
    desc: 'Generate an image from a text prompt.',
  },
  {
    id: 'image_to_image',
    name: 'Image to Image',
    input: 'prompt + image(s)',
    output: 'image',
    desc: 'Edit a single image (style transfer, object removal, etc.) or fuse multiple reference images into one.',
  },
  {
    id: 'text_to_video',
    name: 'Text to Video',
    input: 'prompt',
    output: 'video',
    desc: 'Generate a video from a text prompt.',
  },
  {
    id: 'image_to_video',
    name: 'Image to Video',
    input: 'prompt + image',
    output: 'video',
    desc: 'Generate a video using the input image as the first frame.',
  },
  {
    id: 'first_last_frame_to_video',
    name: 'First & Last Frame to Video',
    input: 'prompt + 2 images',
    output: 'video',
    desc: 'Generate a video that starts with the first image and ends with the second.',
  },
  {
    id: 'reference_image_to_video',
    name: 'Reference Image to Video',
    input: 'prompt + image(s)',
    output: 'video',
    desc: 'Generate a video using reference images for visual guidance (characters, style, objects) — not as literal frames.',
  },
  {
    id: 'text_to_music',
    name: 'Text to Music',
    input: 'prompt',
    output: 'audio',
    desc: 'Generate instrumental music from a description, or a full song (vocals + music) from lyrics.',
  },
  {
    id: 'text_to_speech',
    name: 'Text to Speech',
    input: 'text',
    output: 'audio',
    desc: 'Convert text into spoken audio (TTS).',
  },
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
        TASK_TYPES.map((t) => [cyan(t.id), t.input, t.output, t.desc]),
        [bold('Task Type'), bold('Input'), bold('Output'), bold('Description')]
      );
      console.log();
    });
};
