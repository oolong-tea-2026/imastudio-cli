'use strict';

const { requireApiKey, getBaseUrl, readCache, writeCache } = require('../config');
const { ImaClient } = require('../api');
const { bold, cyan, dim, green, yellow, table: printTable, spinner, handleError } = require('../output');
const { getTaskTypeIds } = require('../task-types');

/**
 * Flatten V2 product tree into leaf nodes (type=3).
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

/**
 * Fetch products for a task type (with caching).
 */
async function fetchProducts(taskType, apiKey, baseUrl, useCache = true) {
  const cacheKey = `products_${taskType}`;
  if (useCache) {
    const cached = readCache(cacheKey);
    if (cached) return { products: cached, fromCache: true };
  }

  const client = new ImaClient(apiKey, baseUrl);
  const tree = await client.listProducts(taskType);
  const products = flattenProducts(tree);
  writeCache(cacheKey, products);
  return { products, fromCache: false };
}

/**
 * Find a model by --model value (version_id or name).
 */
function findModel(products, modelValue) {
  if (!modelValue) return null;
  const lower = modelValue.toLowerCase();

  let match = products.find((p) => p.id === modelValue);
  if (match) return match;

  match = products.find((p) => p.id.toLowerCase() === lower);
  if (match) return match;

  match = products.find((p) => (p.name || '').toLowerCase() === lower);
  if (match) return match;

  return null;
}

/**
 * Format model rows for table output.
 */
function formatModelRows(products) {
  return products.map((p) => {
    const rules = p.credit_rules || [];
    const costs = [...new Set(rules.map((r) => `${r.points}`))].join('/') + ' pts';
    return [cyan(p.id || ''), p.name || '', costs || dim('—')];
  });
}

module.exports = function registerListModels(program) {
  program
    .command('list-models')
    .description('List available models for a task type (or all task types if omitted)')
    .argument('[task-type]', 'Task type (e.g., text_to_image). Omit to list all.')
    .option('--no-cache', 'Skip cache and fetch fresh data')
    .action(async (taskType, opts, cmd) => {
      const rootOpts = cmd.optsWithGlobals();

      try {
        const apiKey = requireApiKey(rootOpts);
        const baseUrl = getBaseUrl(rootOpts);
        const useCache = opts.cache !== false;

        if (taskType) {
          // Single task type
          await listModelsForType(taskType, apiKey, baseUrl, useCache, rootOpts);
        } else {
          // All task types
          const taskTypeIds = getTaskTypeIds();
          const spin = spinner(`Fetching models for ${taskTypeIds.length} task types...`);

          if (rootOpts.json) {
            const allData = {};
            for (const tt of taskTypeIds) {
              const { products } = await fetchProducts(tt, apiKey, baseUrl, useCache);
              allData[tt] = products;
            }
            spin.stop();
            console.log(JSON.stringify(allData, null, 2));
            return;
          }

          const allResults = [];
          for (const tt of taskTypeIds) {
            const { products } = await fetchProducts(tt, apiKey, baseUrl, useCache);
            allResults.push({ taskType: tt, products });
          }
          spin.stop();

          for (const { taskType: tt, products } of allResults) {
            if (!products.length) continue;
            console.log(`\n${bold(tt)}\n`);
            printTable(
              formatModelRows(products),
              [bold('Model'), bold('Name'), bold('Cost')]
            );
          }
          console.log();
        }
      } catch (err) {
        handleError(err);
      }
    });
};

async function listModelsForType(taskType, apiKey, baseUrl, useCache, rootOpts) {
  const spin = spinner(`Fetching models for ${taskType}...`);
  const { products, fromCache } = await fetchProducts(taskType, apiKey, baseUrl, useCache);
  spin.stop(fromCache ? null : `${green('✓')} Found ${products.length} models`);

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
  printTable(
    formatModelRows(products),
    [bold('Model'), bold('Name'), bold('Cost')]
  );
  console.log(`\n${dim(`Use ${cyan('ima model-info <model> --task-type ' + taskType)} for details.`)}\n`);
}

module.exports.flattenProducts = flattenProducts;
module.exports.fetchProducts = fetchProducts;
module.exports.findModel = findModel;
