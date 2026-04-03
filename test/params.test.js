'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fixtures = require('./fixtures.json');

// ── Import tested module ────────────────────────────────────
const {
  resolveVirtualParam,
  extractFormDefaults,
  resolveExtraVirtualParams,
  getValidAttributeKeys,
  selectCreditRule,
  buildInnerParams,
} = require('../src/params');


// ── Tests ───────────────────────────────────────────────────

describe('Group 1: Virtual param resolution', () => {
  const cases = fixtures.filter((f) => f.group === 'virtual_param_resolution');

  for (const tc of cases) {
    it(`${tc.model}/${tc.task_type}: ${tc.input.virtual_field}=${tc.input.value} → ${tc.expected.param}=${tc.expected.value}`, () => {
      // We need the actual form_config to test. Load from fixtures or mock.
      // For unit tests, we construct a minimal virtual field config.
      const mockField = buildMockVirtualField(tc);
      const overrides = { [tc.input.virtual_field]: tc.input.value };
      const result = resolveVirtualParam(mockField, overrides);

      assert.strictEqual(Object.keys(result)[0], tc.expected.param);
      assert.strictEqual(Object.values(result)[0], tc.expected.value);
    });
  }
});

describe('Group 2: credit_rule selection', () => {
  const cases = fixtures.filter((f) => f.group === 'credit_rule_selection');

  for (const tc of cases) {
    it(`${tc.model_id}/${tc.task_type} params=${JSON.stringify(tc.user_params)} → attr_id=${tc.expected.attribute_id}`, () => {
      // Load cached product data
      const products = loadCachedProducts(tc.task_type);
      const model = products.find((p) => p.id === tc.version_id);
      assert.ok(model, `Model ${tc.version_id} not found in cache`);

      const selected = selectCreditRule(model.credit_rules || [], tc.user_params, tc.task_type);
      assert.ok(selected, 'No rule selected');
      assert.strictEqual(selected.attribute_id, tc.expected.attribute_id);
      assert.strictEqual(selected.points, tc.expected.points);
    });
  }
});

describe('Group 3: form_config defaults', () => {
  const cases = fixtures.filter((f) => f.group === 'form_config_defaults');

  for (const tc of cases) {
    it(`${tc.model_id}/${tc.task_type} defaults`, () => {
      const products = loadCachedProducts(tc.task_type);
      const model = products.find((p) => p.id === tc.version_id);
      assert.ok(model, `Model ${tc.version_id} not found in cache`);

      const formDefaults = extractFormDefaults(model.form_config || []);
      assert.deepStrictEqual(formDefaults, tc.expected_form_params);
    });
  }
});

describe('Group 4: Full parameter merge', () => {
  const cases = fixtures.filter((f) => f.group === 'full_param_merge');

  for (const tc of cases) {
    it(`${tc.model_id}/${tc.task_type} extra=${JSON.stringify(tc.extra_params)} → ${JSON.stringify(tc.expected_inner_contains)}`, () => {
      const products = loadCachedProducts(tc.task_type);
      const model = products.find((p) => p.id === tc.version_id);
      assert.ok(model, `Model ${tc.version_id} not found in cache`);

      const { inner } = buildInnerParams(model, tc.task_type, tc.extra_params);

      for (const [k, v] of Object.entries(tc.expected_inner_contains)) {
        assert.strictEqual(
          String(inner[k]),
          String(v),
          `Expected ${k}=${v}, got ${k}=${inner[k]}`
        );
      }
    });
  }
});


// ── Test helpers ────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

/**
 * Load product data from test fixtures (bundled) or local cache (fallback).
 */
function loadCachedProducts(taskType) {
  // 1. Try bundled test fixtures first (CI-friendly)
  const fixtureFile = path.join(__dirname, 'fixtures', `products_${taskType}.json`);
  if (fs.existsSync(fixtureFile)) {
    return JSON.parse(fs.readFileSync(fixtureFile, 'utf-8'));
  }
  // 2. Fallback to local cache
  const cacheFile = path.join(
    require('os').homedir(), '.imastudio', 'cache', `products_${taskType}.json`
  );
  if (!fs.existsSync(cacheFile)) {
    throw new Error(`Cache not found. Run: ima list-models ${taskType}`);
  }
  return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
}

/**
 * Build mock virtual field from fixture data.
 * We reconstruct the mapping rules from the known test patterns.
 */
function buildMockVirtualField(tc) {
  // Known virtual param mappings
  const VIRTUAL_CONFIGS = {
    'SeeDream 4.5': {
      field: 'size', virtualField: 'aspect_ratio',
      rules: [
        { s: '1:1', t: '2048x2048' }, { s: '2:3', t: '1664x2496' },
        { s: '3:2', t: '2496x1664' }, { s: '3:4', t: '1728x2304' },
        { s: '4:3', t: '2304x1728' }, { s: '9:16', t: '1440x2560' },
        { s: '16:9', t: '2560x1440' }, { s: '21:9', t: '3024x1296' },
        { s: '2k', t: '2k' }, { s: '4k', t: '4k' },
      ],
    },
    'Seedance 2.0': {
      field: 'aspect_ratio', virtualField: 'aspect_ratio',
      rules: [
        { s: '1:1', t: '1:1' }, { s: '4:3', t: '4:3' }, { s: '3:4', t: '3:4' },
        { s: '16:9', t: '16:9' }, { s: '9:16', t: '9:16' }, { s: '21:9', t: '21:9' },
        { s: 'adaptive', t: 'auto' },
      ],
    },
    'Kling O1': {
      field: 'mode', virtualField: 'quality',
      rules: [{ s: '720p', t: 'std' }, { s: '1080p', t: 'pro' }],
    },
    'Kling 2.6': {
      field: 'mode', virtualField: 'quality',
      rules: [{ s: '1080p', t: 'pro' }],
    },
  };

  const config = VIRTUAL_CONFIGS[tc.model];
  if (!config) throw new Error(`No mock config for ${tc.model}`);

  return {
    field: config.field,
    value: null,
    is_ui_virtual: true,
    ui_params: [{ field: config.virtualField, value: null }],
    value_mapping: {
      source_params: [config.virtualField],
      target_param: config.field,
      mapping_rules: config.rules.map((r) => ({
        source_values: { [config.virtualField]: r.s },
        target_value: r.t,
      })),
    },
  };
}
