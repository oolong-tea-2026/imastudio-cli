'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

const BIN = path.join(__dirname, '..', 'bin', 'ima.js');

describe('fm-pack (ffmpeg)', () => {
  it('fm-pack -version exits 0 and prints ffmpeg version', () => {
    const out = execFileSync(process.execPath, [BIN, 'fm-pack', '-version'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.match(out, /ffmpeg version/);
  });

  it('fm-pack with no args exits 1 (ffmpeg expects input)', () => {
    assert.throws(
      () => execFileSync(process.execPath, [BIN, 'fm-pack'], { encoding: 'utf8', timeout: 10000 }),
      (err) => err.status === 1
    );
  });
});

describe('fm-probe (ffprobe)', () => {
  it('fm-probe -version exits 0 and prints ffprobe version', () => {
    const out = execFileSync(process.execPath, [BIN, 'fm-probe', '-version'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.match(out, /ffprobe version/);
  });

  it('fm-probe with invalid file exits non-zero', () => {
    assert.throws(
      () =>
        execFileSync(process.execPath, [BIN, 'fm-probe', '/dev/null'], {
          encoding: 'utf8',
          timeout: 10000,
        }),
      (err) => err.status !== 0
    );
  });
});
