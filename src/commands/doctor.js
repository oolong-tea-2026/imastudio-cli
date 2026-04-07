'use strict';

const fs = require('fs');
const { getApiKey, CONFIG_DIR, CREDENTIALS_FILE } = require('../config');
const { ImaClient } = require('../api');
const { bold, cyan, dim, green, yellow, red, handleError } = require('../output');
const pkg = require('../../package.json');

module.exports = function registerDoctor(program) {
  program
    .command('doctor')
    .description('Check environment, config, and API connectivity')
    .action(async (opts, cmd) => {
      const rootOpts = cmd.optsWithGlobals();

      console.log(`\n${bold('IMA Studio CLI Doctor')}\n`);

      // 1. Version
      console.log(`  ${bold('Version:')}     ${pkg.version}`);
      console.log(`  ${bold('Node.js:')}     ${process.version}`);

      // 2. Config dir
      const configExists = fs.existsSync(CONFIG_DIR);
      console.log(`  ${bold('Config dir:')}  ${configExists ? green('✓') : yellow('✗')} ${CONFIG_DIR}`);

      // 3. Credentials
      const credExists = fs.existsSync(CREDENTIALS_FILE);
      console.log(`  ${bold('Credentials:')} ${credExists ? green('✓') : yellow('✗')} ${credExists ? 'found' : 'not found'}`);

      // 4. API Key
      const apiKey = getApiKey(rootOpts);
      const keySource = rootOpts?.apiKey
        ? 'CLI flag'
        : process.env.IMA_API_KEY
          ? 'environment variable'
          : credExists
            ? 'credentials file'
            : null;

      if (apiKey) {
        const masked = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
        console.log(`  ${bold('API Key:')}    ${green('✓')} ${masked} ${dim(`(from ${keySource})`)}`);

        // 5. API connectivity
        process.stdout.write(`  ${bold('API:')}         `);
        try {
          const client = new ImaClient(apiKey);
          await client.listProducts('text_to_image');
          console.log(`${green('✓')} Connected`);
        } catch (err) {
          console.log(`${red('✗')} ${err.message}`);
        }
      } else {
        console.log(`  ${bold('API Key:')}    ${red('✗')} not configured`);
        console.log(`  ${bold('API:')}         ${dim('skipped (no key)')}`);
        console.log(`\n  Run ${cyan('ima init')} to configure your API key.`);
        console.log(`  Get your API key at: ${cyan('https://imastudio.com')}`);
      }

      console.log();
    });
};
