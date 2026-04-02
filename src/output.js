'use strict';

const NO_COLOR = process.env.NO_COLOR || process.argv.includes('--no-color');

const colors = {
  reset: NO_COLOR ? '' : '\x1b[0m',
  bold: NO_COLOR ? '' : '\x1b[1m',
  dim: NO_COLOR ? '' : '\x1b[2m',
  red: NO_COLOR ? '' : '\x1b[31m',
  green: NO_COLOR ? '' : '\x1b[32m',
  yellow: NO_COLOR ? '' : '\x1b[33m',
  blue: NO_COLOR ? '' : '\x1b[34m',
  cyan: NO_COLOR ? '' : '\x1b[36m',
  white: NO_COLOR ? '' : '\x1b[37m',
};

function bold(s) { return `${colors.bold}${s}${colors.reset}`; }
function dim(s) { return `${colors.dim}${s}${colors.reset}`; }
function red(s) { return `${colors.red}${s}${colors.reset}`; }
function green(s) { return `${colors.green}${s}${colors.reset}`; }
function yellow(s) { return `${colors.yellow}${s}${colors.reset}`; }
function blue(s) { return `${colors.blue}${s}${colors.reset}`; }
function cyan(s) { return `${colors.cyan}${s}${colors.reset}`; }

/**
 * Print table with aligned columns
 */
function table(rows, headers) {
  if (!rows.length) return;

  const allRows = headers ? [headers, ...rows] : rows;
  const colWidths = [];

  for (const row of allRows) {
    row.forEach((cell, i) => {
      const len = stripAnsi(String(cell)).length;
      colWidths[i] = Math.max(colWidths[i] || 0, len);
    });
  }

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const line = row
      .map((cell, j) => {
        const str = String(cell);
        const pad = colWidths[j] - stripAnsi(str).length;
        return str + ' '.repeat(Math.max(0, pad));
      })
      .join('  ');
    console.log(line);

    // Separator after header
    if (i === 0 && headers) {
      console.log(colWidths.map((w) => '─'.repeat(w)).join('──'));
    }
  }
}

function stripAnsi(s) {
  return s.replace(/\x1b\[\d+m/g, '');
}

/**
 * Spinner for long operations
 */
function spinner(text) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const id = setInterval(() => {
    process.stderr.write(`\r${frames[i++ % frames.length]} ${text}`);
  }, 80);

  return {
    stop(finalText) {
      clearInterval(id);
      process.stderr.write(`\r${' '.repeat(text.length + 4)}\r`);
      if (finalText) console.error(finalText);
    },
    update(newText) {
      text = newText;
    },
  };
}

/**
 * Handle errors consistently
 */
function handleError(err) {
  if (err.name === 'ApiError') {
    console.error(`${red('✗')} API Error (${err.code}): ${err.message}`);
  } else {
    console.error(`${red('✗')} ${err.message}`);
  }
  process.exit(1);
}

module.exports = { colors, bold, dim, red, green, yellow, blue, cyan, table, spinner, handleError, stripAnsi };
