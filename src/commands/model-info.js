'use strict';

const { requireApiKey, getBaseUrl, readCache, writeCache } = require('../config');
const { ImaClient } = require('../api');
const { bold, cyan, dim, green, yellow, table: printTable, spinner, handleError } = require('../output');
const { flattenProducts } = require('./list-models');

module.exports = function registerModelInfo(program) {
  program
    .command('model-info')
    .description('Show detailed info about a specific model')
    .argument('<model-id>', 'Model ID (e.g., doubao-seedream-4.5, gemini-3-pro-image)')
    .requiredOption('--task-type <type>', 'Task type (e.g., text_to_image)')
    .action(async (modelId, opts, cmd) => {
      const rootOpts = cmd.optsWithGlobals();

      try {
        const apiKey = requireApiKey(rootOpts);
        const baseUrl = getBaseUrl(rootOpts);

        const cacheKey = `products_${opts.taskType}`;
        let products = readCache(cacheKey);

        if (!products) {
          const spin = spinner('Fetching model data...');
          const client = new ImaClient(apiKey, baseUrl);
          const tree = await client.listProducts(opts.taskType);
          products = flattenProducts(tree);
          writeCache(cacheKey, products);
          spin.stop();
        }

        const model = products.find((p) => p.model_id === modelId);

        if (!model) {
          console.error(`Model "${modelId}" not found for task type "${opts.taskType}".`);
          console.error(`Run ${cyan(`ima list-models ${opts.taskType}`)} to see available models.`);
          process.exit(1);
        }

        if (rootOpts.json) {
          console.log(JSON.stringify(model, null, 2));
          return;
        }

        console.log(`\n${bold(model.name)} ${dim(`(${model.model_id})`)}\n`);
        console.log(`  Version ID:  ${cyan(model.id)}`);
        console.log(`  Task Type:   ${opts.taskType}`);

        // Credit rules
        const rules = model.credit_rules || [];
        if (rules.length) {
          console.log(`\n  ${bold('Pricing:')}`);
          printTable(
            rules.map((r) => {
              const attrs = r.attributes || {};
              const desc = Object.entries(attrs)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ') || 'default';
              return ['  ', `${r.points} pts`, dim(`(attribute_id: ${r.attribute_id})`), dim(desc)];
            }),
            null
          );
        }

        // Form config (default params)
        const formConfig = model.form_config || [];
        if (formConfig.length) {
          console.log(`\n  ${bold('Parameters:')}`);
          for (const f of formConfig) {
            const options = (f.options || []).map((o) => o.value || o.label).join(', ');
            console.log(`    ${cyan(f.field)}: ${f.value || '—'}${options ? dim(` [${options}]`) : ''}`);
          }
        }

        console.log();
      } catch (err) {
        handleError(err);
      }
    });
};
