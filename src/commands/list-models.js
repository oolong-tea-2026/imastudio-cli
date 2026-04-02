'use strict';

const { requireApiKey, getBaseUrl, readCache, writeCache } = require('../config');
const { ImaClient } = require('../api');
const { bold, cyan, dim, green, yellow, table: printTable, spinner, handleError } = require('../output');

/**
 * Flatten V2 product tree into leaf nodes (type=3)
 */
function flattenProducts(tree) {
  const leaves = [];
  for (const group of tree) {
    for (const child of group.children || []) {
      if (child.type === '3') {
        leaves.push({ ...child, group_name: group.name });
      }
      for (const gc of child.children || []) {
        if (gc.type === '3') {
          leaves.push({ ...gc, group_name: group.name });
        }
      }
    }
  }
  return leaves;
}

module.exports = function registerListModels(program) {
  program
    .command('list-models')
    .description('List available models for a task type')
    .argument('<task-type>', 'Task type (e.g., text_to_image, image_to_image)')
    .option('--no-cache', 'Skip cache and fetch fresh data')
    .action(async (taskType, opts, cmd) => {
      const rootOpts = cmd.optsWithGlobals();

      try {
        const apiKey = requireApiKey(rootOpts);
        const baseUrl = getBaseUrl(rootOpts);

        // Check cache (1 hour TTL)
        const cacheKey = `products_${taskType}`;
        let products = opts.cache !== false ? readCache(cacheKey) : null;

        if (!products) {
          const spin = spinner(`Fetching models for ${taskType}...`);
          const client = new ImaClient(apiKey, baseUrl);
          const tree = await client.listProducts(taskType);
          products = flattenProducts(tree);
          writeCache(cacheKey, products);
          spin.stop(`${green('✓')} Found ${products.length} models`);
        }

        if (rootOpts.json) {
          console.log(JSON.stringify(products, null, 2));
          return;
        }

        if (!products.length) {
          console.log(`\nNo models found for task type: ${taskType}`);
          console.log(`Run ${cyan('ima list-task-types')} to see available types.\n`);
          return;
        }

        console.log(`\n${bold(`Models for ${taskType}`)}\n`);

        const rows = products.map((p) => {
          const rules = p.credit_rules || [];
          const costs = rules.map((r) => `${r.points}pts`).join('/');
          const sizes = rules.map((r) => {
            const attrs = r.attributes || {};
            return attrs.size || attrs.resolution || 'default';
          }).join('/');

          return [
            cyan(p.model_id || ''),
            p.name || '',
            costs || dim('—'),
            dim(p.id || ''),
          ];
        });

        printTable(rows, [bold('Model ID'), bold('Name'), bold('Cost'), bold('Version ID')]);
        console.log(`\n${dim(`Use ${cyan('ima model-info <model-id> --task-type ' + taskType)} for details.`)}\n`);
      } catch (err) {
        handleError(err);
      }
    });
};

module.exports.flattenProducts = flattenProducts;
