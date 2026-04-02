'use strict';

const { requireApiKey, getBaseUrl } = require('../config');
const { bold, cyan, dim, green, yellow, table: printTable, spinner, handleError } = require('../output');
const { fetchProducts, findModel } = require('./list-models');

/**
 * Common input requirements by task type.
 * These are always needed but not in form_config.
 */
const TASK_INPUTS = {
  text_to_image:             { prompt: 'required', images: null },
  image_to_image:            { prompt: 'required', images: '1+ images' },
  text_to_video:             { prompt: 'required', images: null },
  image_to_video:            { prompt: 'required', images: '1 image (first frame)' },
  first_last_frame_to_video: { prompt: 'required', images: '2 images (first + last frame)' },
  reference_image_to_video:  { prompt: 'required', images: '1+ images (visual reference)' },
  text_to_music:             { prompt: 'required (description or lyrics)', images: null },
  text_to_speech:            { prompt: 'required (text to speak)', images: null },
};

module.exports = function registerModelInfo(program) {
  program
    .command('model-info')
    .description('Show detailed info about a specific model')
    .argument('<model>', 'Model identifier (version_id or name from "ima list-models")')
    .requiredOption('--task-type <type>', 'Task type (e.g., text_to_image)')
    .action(async (modelValue, opts, cmd) => {
      const rootOpts = cmd.optsWithGlobals();

      try {
        const apiKey = requireApiKey(rootOpts);
        const baseUrl = getBaseUrl(rootOpts);

        const spin = spinner('Fetching model data...');
        const { products } = await fetchProducts(opts.taskType, apiKey, baseUrl);
        spin.stop();

        const model = findModel(products, modelValue);

        if (!model) {
          console.error(`Model "${modelValue}" not found for task type "${opts.taskType}".`);
          console.error(`Run ${cyan(`ima list-models ${opts.taskType}`)} to see available models.`);
          process.exit(1);
        }

        if (rootOpts.json) {
          const inputs = TASK_INPUTS[opts.taskType] || { prompt: 'required', images: null };
          const enriched = { ...model, common_inputs: inputs };
          console.log(JSON.stringify(enriched, null, 2));
          return;
        }

        console.log(`\n${bold(model.name)} ${dim(`(${model.id})`)}\n`);
        console.log(`  Task Type:   ${opts.taskType}`);

        // Parameters: common inputs first, then model-specific from form_config
        const inputs = TASK_INPUTS[opts.taskType] || { prompt: 'required', images: null };
        const formConfig = model.form_config || [];

        console.log(`\n  ${bold('Parameters:')}`);
        console.log(`    ${cyan('prompt')}: ${inputs.prompt}`);
        if (inputs.images) {
          console.log(`    ${cyan('input_images')}: ${inputs.images}`);
        }
        for (const f of formConfig) {
          const options = (f.options || []).map((o) => o.value || o.label).join(', ');
          console.log(`    ${cyan(f.field)}: ${f.value || '—'}${options ? dim(` [${options}]`) : ''}`);
        }

        // Credit rules
        const rules = model.credit_rules || [];
        if (rules.length) {
          console.log(`\n  ${bold('Pricing:')}`);
          printTable(
            rules.map((r) => {
              const attrs = r.attributes || {};
              const desc = Object.entries(attrs)
                .filter(([k, v]) => !(k === 'default' && v === 'enabled'))
                .map(([k, v]) => `${k}=${v}`)
                .join(', ') || 'default';
              return ['  ', `${r.points} pts`, dim(desc)];
            }),
            null
          );
        }

        console.log();
      } catch (err) {
        handleError(err);
      }
    });
};
