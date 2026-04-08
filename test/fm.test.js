'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

const BIN = path.join(__dirname, '..', 'bin', 'ima.js');

describe('ffmpeg (ffmpeg)', () => {
  it('ffmpeg -version exits 0 and prints ffmpeg version', () => {
    const out = execFileSync(process.execPath, [BIN, 'ffmpeg', '-version'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.match(out, /ffmpeg version/);
  });

  it('ffmpeg with no args exits 1 (ffmpeg expects input)', () => {
    assert.throws(
      () => execFileSync(process.execPath, [BIN, 'ffmpeg'], { encoding: 'utf8', timeout: 10000 }),
      (err) => err.status === 1
    );
  });
});

describe('ffprobe (ffprobe)', () => {
  it('ffprobe -version exits 0 and prints ffprobe version', () => {
    const out = execFileSync(process.execPath, [BIN, 'ffprobe', '-version'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.match(out, /ffprobe version/);
  });

  it('ffprobe with invalid file exits non-zero', () => {
    assert.throws(
      () =>
        execFileSync(process.execPath, [BIN, 'ffprobe', '/dev/null'], {
          encoding: 'utf8',
          timeout: 10000,
        }),
      (err) => err.status !== 0
    );
  });
});
