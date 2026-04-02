'use strict';

const fs = require('fs');
const path = require('path');
const { requireApiKey, getBaseUrl, readCache, writeCache } = require('../config');
const { ImaClient, uploadToOss } = require('../api');
const { bold, cyan, dim, green, yellow, red, spinner, handleError } = require('../output');
const { flattenProducts } = require('./list-models');

module.exports = function registerCreateTask(program) {
  program
    .command('create-task')
    .description('Create an AI generation task')
    .requiredOption('--task-type <type>', 'Task type (text_to_image, image_to_image, etc.)')
    .requiredOption('--model-id <id>', 'Model ID (use "ima list-models" to find)')
    .requiredOption('--prompt <text>', 'Generation prompt')
    .option('--input-images <paths...>', 'Input image(s) — local paths or URLs (for i2i tasks)')
    .option('--size <size>', 'Output size (e.g., 1K, 2K, 4K, 512px)')
    .option('--aspect-ratio <ratio>', 'Aspect ratio (e.g., 16:9, 9:16, 4:3)')
    .option('--n <count>', 'Number of outputs (default: 1)', '1')
    .option('--attribute-id <id>', 'Override attribute_id (advanced)')
    .option('--wait', 'Wait for task to complete and print result URL')
    .option('--poll-interval <seconds>', 'Polling interval in seconds (default: 5)', '5')
    .option('--timeout <seconds>', 'Max wait time in seconds (default: 300)', '300')
    .action(async (opts, cmd) => {
      const rootOpts = cmd.optsWithGlobals();

      try {
        const apiKey = requireApiKey(rootOpts);
        const baseUrl = getBaseUrl(rootOpts);
        const client = new ImaClient(apiKey, baseUrl);

        // 1. Fetch product info
        const cacheKey = `products_${opts.taskType}`;
        let products = readCache(cacheKey);
        if (!products) {
          const spin = spinner('Fetching product info...');
          const tree = await client.listProducts(opts.taskType);
          products = flattenProducts(tree);
          writeCache(cacheKey, products);
          spin.stop();
        }

        const model = products.find((p) => p.model_id === opts.modelId);
        if (!model) {
          console.error(`${red('✗')} Model "${opts.modelId}" not found for ${opts.taskType}.`);
          console.error(`Run: ${cyan(`ima list-models ${opts.taskType}`)}`);
          process.exit(1);
        }

        // 2. Select credit rule (match by size if specified)
        const rules = model.credit_rules || [];
        let rule;

        if (opts.attributeId) {
          rule = rules.find((r) => String(r.attribute_id) === String(opts.attributeId));
        } else if (opts.size) {
          rule = rules.find((r) => {
            const attrs = r.attributes || {};
            return Object.values(attrs).some(
              (v) => String(v).toLowerCase() === opts.size.toLowerCase()
            );
          });
        }

        if (!rule) rule = rules[0];

        if (!rule) {
          console.error(`${red('✗')} No pricing rule found for this model.`);
          process.exit(1);
        }

        // 3. Upload input images if needed
        let inputImageUrls = [];
        if (opts.inputImages && opts.inputImages.length) {
          for (const img of opts.inputImages) {
            if (img.startsWith('http://') || img.startsWith('https://')) {
              inputImageUrls.push(img);
            } else {
              const spin = spinner(`Uploading ${path.basename(img)}...`);
              const resolved = path.resolve(img);
              if (!fs.existsSync(resolved)) {
                spin.stop(`${red('✗')} File not found: ${resolved}`);
                process.exit(1);
              }
              const ext = path.extname(resolved).toLowerCase();
              const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[ext] || 'image/jpeg';
              const buffer = fs.readFileSync(resolved);
              const url = await uploadToOss(buffer, mime, apiKey);
              inputImageUrls.push(url);
              spin.stop(`${green('✓')} Uploaded: ${dim(path.basename(img))}`);
            }
          }
        }

        // 4. Build form defaults from product config
        const formDefaults = {};
        for (const f of model.form_config || []) {
          if (f.value !== undefined && f.value !== null) {
            formDefaults[f.field] = f.value;
          }
        }

        // 5. Build nested parameters
        const nestedParams = {
          prompt: opts.prompt,
          n: parseInt(opts.n, 10),
          input_images: inputImageUrls,
          cast: { points: rule.points, attribute_id: rule.attribute_id },
          ...formDefaults,
        };

        if (opts.size) nestedParams.size = opts.size;
        if (opts.aspectRatio) nestedParams.aspect_ratio = opts.aspectRatio;

        // 6. Create task
        const payload = {
          task_type: opts.taskType,
          enable_multi_model: false,
          src_img_url: inputImageUrls,
          parameters: [
            {
              attribute_id: rule.attribute_id,
              model_id: model.model_id,
              model_name: model.name,
              model_version: model.id,
              app: 'ima',
              platform: 'web',
              category: opts.taskType,
              credit: rule.points,
              parameters: nestedParams,
            },
          ],
        };

        const spin2 = spinner('Creating task...');
        const result = await client.createTask(payload);
        const taskId = result.id;
        spin2.stop(`${green('✓')} Task created: ${cyan(taskId)}`);

        if (rootOpts.json && !opts.wait) {
          console.log(JSON.stringify({ task_id: taskId, model: model.name, credit: rule.points }));
          return;
        }

        if (!opts.wait) {
          console.log(`\n  Task ID:  ${cyan(taskId)}`);
          console.log(`  Model:   ${model.name}`);
          console.log(`  Cost:    ${rule.points} pts`);
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

          // Check for failure
          if (task.status === 'failed' || medias.some((m) => (m.resource_status ?? 0) === 2)) {
            spin3.stop(`${red('✗')} Task failed`);
            if (rootOpts.json) console.log(JSON.stringify(task));
            else console.error(`Task ${taskId} failed.`);
            process.exit(1);
          }

          // Check for completion
          const allDone = medias.length > 0 && medias.every((m) => (m.resource_status ?? 0) === 1 && m.url);
          if (allDone) {
            spin3.stop(`${green('✓')} Complete! (${elapsed}s)`);
            if (rootOpts.json) {
              console.log(JSON.stringify({
                task_id: taskId,
                model: model.name,
                credit: rule.points,
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
