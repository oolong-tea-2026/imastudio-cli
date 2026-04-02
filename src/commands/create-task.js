'use strict';

const fs = require('fs');
const path = require('path');
const { requireApiKey, getBaseUrl } = require('../config');
const { ImaClient, uploadToOss } = require('../api');
const { bold, cyan, dim, green, yellow, red, spinner, handleError } = require('../output');
const { fetchProducts, findModel } = require('./list-models');
const { buildInnerParams } = require('../params');

/**
 * Parse --param key=value pairs into an object.
 * Repeated keys become arrays.
 */
function parseParams(paramList) {
  const result = {};
  if (!paramList || !paramList.length) return result;

  for (const item of paramList) {
    const eqIdx = item.indexOf('=');
    if (eqIdx === -1) {
      console.error(`${red('✗')} Invalid --param format: "${item}" (expected key=value)`);
      process.exit(1);
    }
    const key = item.substring(0, eqIdx).trim();
    const value = item.substring(eqIdx + 1).trim();

    if (key in result) {
      if (Array.isArray(result[key])) {
        result[key].push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Resolve input_images: upload local files, pass URLs through.
 */
async function resolveInputImages(images, apiKey) {
  if (!images) return [];
  const list = Array.isArray(images) ? images : [images];
  const urls = [];

  for (const img of list) {
    if (img.startsWith('http://') || img.startsWith('https://')) {
      urls.push(img);
    } else {
      const resolved = path.resolve(img);
      if (!fs.existsSync(resolved)) {
        console.error(`${red('✗')} File not found: ${resolved}`);
        process.exit(1);
      }
      const spin = spinner(`Uploading ${path.basename(resolved)}...`);
      const ext = path.extname(resolved).toLowerCase();
      const mime = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
      }[ext] || 'image/jpeg';
      const buffer = fs.readFileSync(resolved);
      const url = await uploadToOss(buffer, mime, apiKey);
      urls.push(url);
      spin.stop(`${green('✓')} Uploaded: ${dim(path.basename(resolved))}`);
    }
  }

  return urls;
}

module.exports = function registerCreateTask(program) {
  program
    .command('create-task')
    .description('Create an AI generation task')
    .requiredOption('--task-type <type>', 'Task type (e.g., text_to_image, text_to_video)')
    .requiredOption('--model <model>', 'Model (from "ima list-models")')
    .option('--param <key=value...>', 'Model parameter (repeatable, e.g., --param prompt="a cat" --param size=4k)')
    .option('--wait', 'Wait for task to complete and print result URL')
    .option('--poll-interval <seconds>', 'Polling interval in seconds (default: 5)', '5')
    .option('--timeout <seconds>', 'Max wait time in seconds (default: 300)', '300')
    .action(async (opts, cmd) => {
      const rootOpts = cmd.optsWithGlobals();

      try {
        const apiKey = requireApiKey(rootOpts);
        const baseUrl = getBaseUrl(rootOpts);
        const client = new ImaClient(apiKey, baseUrl);

        // 1. Parse --param key=value pairs
        const params = parseParams(opts.param);

        if (!params.prompt) {
          console.error(`${red('✗')} Missing required parameter: --param prompt="your prompt"`);
          process.exit(1);
        }

        // 2. Fetch product info
        const spin1 = spinner('Fetching product info...');
        const { products } = await fetchProducts(opts.taskType, apiKey, baseUrl);
        spin1.stop();

        const model = findModel(products, opts.model);
        if (!model) {
          console.error(`${red('✗')} Model "${opts.model}" not found for ${opts.taskType}.`);
          console.error(`Run: ${cyan(`ima list-models ${opts.taskType}`)}`);
          process.exit(1);
        }

        // 3. Upload input images if provided
        const inputImageUrls = await resolveInputImages(params.input_images, apiKey);
        delete params.input_images;

        // 4. Build inner params using tested logic (virtual resolution, credit rule selection, normalization)
        const { prompt, ...extraParams } = params;
        const { inner, selectedRule } = buildInnerParams(model, opts.taskType, extraParams);

        if (!selectedRule) {
          console.error(`${red('✗')} No pricing rule found for this model.`);
          process.exit(1);
        }

        // 5. Set required fields
        inner.prompt = prompt;
        inner.n = parseInt(inner.n || '1', 10);
        inner.input_images = inputImageUrls;
        inner.cast = { points: selectedRule.points, attribute_id: selectedRule.attribute_id };

        // 6. Create task
        const payload = {
          task_type: opts.taskType,
          enable_multi_model: false,
          src_img_url: inputImageUrls,
          parameters: [
            {
              attribute_id: selectedRule.attribute_id,
              model_id: model.model_id,
              model_name: model.name,
              model_version: model.id,
              app: 'ima',
              platform: 'web',
              category: opts.taskType,
              credit: selectedRule.points,
              parameters: inner,
            },
          ],
        };

        const spin2 = spinner('Creating task...');
        const result = await client.createTask(payload);
        const taskId = result.id;
        spin2.stop(`${green('✓')} Task created: ${cyan(taskId)}`);

        if (rootOpts.json && !opts.wait) {
          console.log(JSON.stringify({ task_id: taskId, model: model.name, model_version: model.id, credit: selectedRule.points }));
          return;
        }

        if (!opts.wait) {
          console.log(`\n  Task ID:  ${cyan(taskId)}`);
          console.log(`  Model:   ${model.name} ${dim(`(${model.id})`)}`);
          console.log(`  Cost:    ${selectedRule.points} pts`);
          console.log(`\n  Check status: ${cyan(`ima task-status ${taskId}`)}`);
          if (!rootOpts.json) console.log(`  Or wait:      ${cyan(`ima create-task ... --wait`)}\n`);
          return;
        }

        // 7. Poll for result
        const interval = parseInt(opts.pollInterval, 10) * 1000;
        const timeout = parseInt(opts.timeout, 10) * 1000;
        const start = Date.now();
        const spin3 = spinner('Waiting for result...');

        while (Date.now() - start < timeout) {
          await sleep(interval);
          const elapsed = Math.round((Date.now() - start) / 1000);
          spin3.update(`Waiting for result... ${elapsed}s`);

          const task = await client.getTaskDetail(taskId);
          const medias = task.medias || [];

          if (task.status === 'failed' || medias.some((m) => (m.resource_status ?? 0) === 2)) {
            spin3.stop(`${red('✗')} Task failed`);
            if (rootOpts.json) console.log(JSON.stringify(task));
            else console.error(`Task ${taskId} failed.`);
            process.exit(1);
          }

          const allDone = medias.length > 0 && medias.every((m) => (m.resource_status ?? 0) === 1 && m.url);
          if (allDone) {
            spin3.stop(`${green('✓')} Complete! (${elapsed}s)`);
            if (rootOpts.json) {
              console.log(JSON.stringify({
                task_id: taskId,
                model: model.name,
                model_version: model.id,
                credit: selectedRule.points,
                elapsed_seconds: elapsed,
                results: medias.map((m) => ({ url: m.url, width: m.width, height: m.height, format: m.format })),
              }, null, 2));
            } else {
              for (const m of medias) {
                console.log(`\n  ${cyan('URL:')} ${m.url}`);
                if (m.width && m.height) console.log(`  ${dim(`${m.width}×${m.height} ${m.format || ''}`)}`);
              }
              console.log();
            }
            return;
          }
        }

        spin3.stop(`${yellow('⚠')} Timeout after ${opts.timeout}s`);
        console.log(`Task ${taskId} is still processing.`);
        console.log(`Check later: ${cyan(`ima task-status ${taskId}`)}`);
        process.exit(2);
      } catch (err) {
        handleError(err);
      }
    });
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
