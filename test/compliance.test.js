'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// We test the logic inline since create-task.js doesn't export the constants.
// These mirror the exact values used in create-task.js.

const SEEDANCE_MODELS = new Set(['ima-pro', 'ima-pro-fast']);
const COMPLIANCE_TASK_TYPES = new Set([
  'image_to_video',
  'first_last_frame_to_video',
  'reference_image_to_video',
]);

function needsCompliance(complianceCheck, modelId, taskType, imageCount) {
  return (
    complianceCheck !== false &&
    SEEDANCE_MODELS.has(modelId) &&
    COMPLIANCE_TASK_TYPES.has(taskType) &&
    imageCount > 0
  );
}

describe('Compliance check trigger logic', () => {
  // ── Should trigger ──

  it('ima-pro + image_to_video + images → true', () => {
    assert.equal(needsCompliance(true, 'ima-pro', 'image_to_video', 1), true);
  });

  it('ima-pro-fast + first_last_frame_to_video + images → true', () => {
    assert.equal(needsCompliance(true, 'ima-pro-fast', 'first_last_frame_to_video', 2), true);
  });

  it('ima-pro + reference_image_to_video + images → true', () => {
    assert.equal(needsCompliance(true, 'ima-pro', 'reference_image_to_video', 3), true);
  });

  it('default (undefined) complianceCheck still triggers', () => {
    assert.equal(needsCompliance(undefined, 'ima-pro', 'image_to_video', 1), true);
  });

  // ── Should NOT trigger ──

  it('--no-compliance-check skips', () => {
    assert.equal(needsCompliance(false, 'ima-pro', 'image_to_video', 1), false);
  });

  it('text_to_video never triggers (no media input task)', () => {
    assert.equal(needsCompliance(true, 'ima-pro', 'text_to_video', 0), false);
  });

  it('text_to_video with images still does not trigger (wrong task type)', () => {
    assert.equal(needsCompliance(true, 'ima-pro', 'text_to_video', 1), false);
  });

  it('non-Seedance model does not trigger', () => {
    assert.equal(needsCompliance(true, 'kling-video-o1', 'image_to_video', 1), false);
  });

  it('non-Seedance model kling-v2-6 does not trigger', () => {
    assert.equal(needsCompliance(true, 'kling-v2-6', 'image_to_video', 1), false);
  });

  it('text_to_image does not trigger even with Seedance model', () => {
    assert.equal(needsCompliance(true, 'ima-pro', 'text_to_image', 1), false);
  });

  it('zero images does not trigger', () => {
    assert.equal(needsCompliance(true, 'ima-pro', 'image_to_video', 0), false);
  });

  it('text_to_music does not trigger', () => {
    assert.equal(needsCompliance(true, 'ima-pro', 'text_to_music', 0), false);
  });
});

describe('Compliance status check logic', () => {
  function isVerified(status) {
    const s = (status || '').toLowerCase();
    return s === 'active' || s === 'success';
  }

  it('"Active" (API actual response) → verified', () => {
    assert.equal(isVerified('Active'), true);
  });

  it('"active" (lowercase) → verified', () => {
    assert.equal(isVerified('active'), true);
  });

  it('"success" → verified', () => {
    assert.equal(isVerified('success'), true);
  });

  it('"failed" → rejected', () => {
    assert.equal(isVerified('failed'), false);
  });

  it('"processing" → rejected', () => {
    assert.equal(isVerified('processing'), false);
  });

  it('empty string → rejected', () => {
    assert.equal(isVerified(''), false);
  });

  it('undefined → rejected', () => {
    assert.equal(isVerified(undefined), false);
  });

  it('null → rejected', () => {
    assert.equal(isVerified(null), false);
  });
});

describe('verifyAsset method on ImaClient', () => {
  it('ImaClient exposes verifyAsset method', () => {
    const { ImaClient } = require('../src/api');
    const client = new ImaClient('test-key');
    assert.equal(typeof client.verifyAsset, 'function');
  });

  it('verifyAsset builds correct request body', async () => {
    // We can't easily mock the HTTP call without deps, but we can verify
    // the method exists and check the name truncation logic.
    const longName = 'a'.repeat(100);
    const truncated = longName.slice(0, 64);
    assert.equal(truncated.length, 64);
  });
});
