'use strict';

const fs = require('fs');
const path = require('path');
const { requireApiKey } = require('../config');
const { uploadToOss } = require('../api');
const { green, cyan, dim, spinner, handleError } = require('../output');

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

module.exports = function registerUpload(program) {
  program
    .command('upload')
    .description('Upload a file to IMA CDN and get a public URL')
    .argument('<file>', 'Local file path to upload')
    .action(async (filePath, opts, cmd) => {
      const rootOpts = cmd.optsWithGlobals();

      try {
        const apiKey = requireApiKey(rootOpts);
        const resolved = path.resolve(filePath);

        if (!fs.existsSync(resolved)) {
          console.error(`File not found: ${resolved}`);
          process.exit(1);
        }

        const ext = path.extname(resolved).toLowerCase();
        const mime = MIME_MAP[ext] || 'application/octet-stream';
        const buffer = fs.readFileSync(resolved);
        const sizeMb = (buffer.length / 1024 / 1024).toFixed(2);

        const spin = spinner(`Uploading ${path.basename(resolved)} (${sizeMb} MB)...`);

        const cdnUrl = await uploadToOss(buffer, mime, apiKey);

        spin.stop(`${green('✓')} Uploaded successfully`);

        if (rootOpts.json) {
          console.log(JSON.stringify({ url: cdnUrl, file: resolved, size: buffer.length, mime }));
        } else {
          console.log(`\n  ${cyan('URL:')} ${cdnUrl}`);
          console.log(`  ${dim(`${path.basename(resolved)} · ${sizeMb} MB · ${mime}`)}\n`);
        }
      } catch (err) {
        handleError(err);
      }
    });
};
