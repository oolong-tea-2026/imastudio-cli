'use strict';

const { requireApiKey, getBaseUrl } = require('../config');
const { bold, cyan, dim, green, yellow, table: printTable, spinner, handleError } = require('../output');
const { fetchProducts, findModel } = require('./list-models');

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
          console.log(JSON.stringify(model, null, 2));
          return;
        }

        console.log(`\n${bold(model.name)} ${dim(`(${model.id})`)}\n`);
        console.log(`  Task Type:   ${opts.taskType}`);

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
