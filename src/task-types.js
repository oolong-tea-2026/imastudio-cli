'use strict';

// Single source of truth for task types.
// Will be fetched from cloud endpoint later — change only this file.

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

function getTaskTypeIds() {
  return TASK_TYPES.map((t) => t.id);
}

module.exports = { TASK_TYPES, getTaskTypeIds };
