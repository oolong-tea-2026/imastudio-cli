'use strict';

const readline = require('readline');
const { saveApiKey, ensureConfigDir, CONFIG_DIR } = require('../config');
const { ImaClient } = require('../api');
const { green, red, bold, cyan, dim } = require('../output');

module.exports = function registerInit(program) {
  program
    .command('init')
    .description('Interactive setup — configure API key and verify connection')
    .action(async () => {
      console.log(`\n${bold('IMA Studio CLI Setup')}\n`);
      console.log(`Config directory: ${cyan(CONFIG_DIR)}\n`);

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

      try {
        const apiKey = await ask('Enter your IMA API key (ima_xxx): ');

        if (!apiKey || !apiKey.startsWith('ima_')) {
          console.error(`\n${red('✗')} Invalid API key format. Keys start with "ima_".`);
          console.error(`  Get yours at: ${cyan('https://imastudio.com')}`);
          process.exit(1);
        }

        // Verify key
        process.stdout.write('\nVerifying API key... ');
        const client = new ImaClient(apiKey);
        try {
          const products = await client.listProducts('text_to_image');
          console.log(`${green('✓')} Valid! Found ${products.length} model groups.`);
        } catch (err) {
          console.log(`${red('✗')} Failed: ${err.message}`);
          console.error('Please check your API key and try again.');
          process.exit(1);
        }

        // Save
        saveApiKey(apiKey);
        console.log(`\n${green('✓')} API key saved to ${dim(CONFIG_DIR + '/credentials')}`);
        console.log(`  ${dim('(file permissions: 600 — owner read/write only)')}\n`);
        console.log(`You're all set! Try: ${cyan('ima list-task-types')}\n`);
      } finally {
        rl.close();
      }
    });
};
