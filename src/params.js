'use strict';

/**
 * Parameter resolution logic — aligned with ima-all-ai/scripts/ima_create.py.
 * Tested via test/params.test.js against Python ground truth.
 */

/**
 * Resolve a virtual form_config field.
 * Virtual fields use ui_params + value_mapping to translate user-friendly values
 * (e.g., aspect_ratio="16:9") into real API params (e.g., size="2560x1440").
 */
function resolveVirtualParam(field, overrides = {}) {
  const fieldName = field.field;
  const uiParams = field.ui_params || [];
  const valueMapping = field.value_mapping || {};
  const mappingRules = valueMapping.mapping_rules || [];
  const defaultValue = field.value;

  if (uiParams.length && mappingRules.length) {
    const patch = {};
    for (const ui of uiParams) {
      const uiField = ui.field || ui.id || '';
      patch[uiField] = overrides[uiField] !== undefined ? overrides[uiField] : ui.value;
    }

    for (const rule of mappingRules) {
      const source = rule.source_values || {};
      const match = Object.entries(source).every(([k, v]) => patch[k] === v);
      if (match) {
        return { [fieldName]: rule.target_value };
      }
    }
  }

  if (defaultValue !== undefined && defaultValue !== null) {
    return { [fieldName]: defaultValue };
  }
  return {};
}

/**
 * Extract form_config defaults, resolving virtual params with their defaults.
 */
function extractFormDefaults(formConfig) {
  const result = {};
  for (const field of formConfig) {
    if (field.is_ui_virtual) {
      Object.assign(result, resolveVirtualParam(field));
    } else {
      const fname = field.field;
      if (fname && field.value !== undefined && field.value !== null) {
        result[fname] = field.value;
      }
    }
  }
  return result;
}

/**
 * Resolve virtual params in user's extra params before merging.
 * E.g., user passes aspect_ratio="16:9" → resolved to size="2560x1440" for SeeDream.
 */
function resolveExtraVirtualParams(formConfig, extraParams) {
  const resolved = { ...extraParams };

  for (const fc of formConfig) {
    if (!fc.is_ui_virtual) continue;
    const uiParams = fc.ui_params || [];
    const mappingRules = ((fc.value_mapping || {}).mapping_rules) || [];
    const targetParam = fc.field;

    for (const ui of uiParams) {
      const vfield = ui.field;
      if (!(vfield in resolved)) continue;

      const vvalue = resolved[vfield];
      for (const rule of mappingRules) {
        const src = rule.source_values || {};
        if (src[vfield] === vvalue) {
          resolved[targetParam] = rule.target_value;
          if (vfield !== targetParam) {
            delete resolved[vfield];
          }
          break;
        }
      }
    }
  }

  return resolved;
}

/**
 * Get valid attribute keys from credit rules dynamically.
 */
function getValidAttributeKeys(creditRules, taskType) {
  const keys = new Set();
  for (const rule of creditRules) {
    const attrs = rule.attributes || {};
    for (const [k, v] of Object.entries(attrs)) {
      if (taskType === 'text_to_speech') {
        keys.add(k);
      } else if (!(k === 'default' && v === 'enabled')) {
        keys.add(k);
      }
    }
  }
  return keys;
}

/**
 * Select credit rule matching user params.
 * Strategy: exact match → partial match → first rule.
 * Normalized to uppercase for case-insensitive comparison.
 */
function selectCreditRule(creditRules, userParams, taskType) {
  if (!creditRules || !creditRules.length) return null;
  if (!userParams || !Object.keys(userParams).length) return creditRules[0];

  function normalize(v) {
    if (typeof v === 'boolean') return String(v).toLowerCase();
    return String(v).trim().toUpperCase();
  }

  const normalizedUser = {};
  for (const [k, v] of Object.entries(userParams)) {
    normalizedUser[k.toLowerCase().trim()] = normalize(v);
  }

  // Exact: ALL rule attributes match user params
  for (const cr of creditRules) {
    const attrs = cr.attributes || {};
    const normalizedAttrs = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (taskType !== 'text_to_speech' && k === 'default' && v === 'enabled') continue;
      normalizedAttrs[k.toLowerCase().trim()] = normalize(v);
    }
    if (!Object.keys(normalizedAttrs).length) continue;

    if (Object.entries(normalizedAttrs).every(([k, v]) => normalizedUser[k] === v)) {
      return cr;
    }
  }

  // Partial: most matches
  let bestMatch = null;
  let bestCount = 0;
  for (const cr of creditRules) {
    const attrs = cr.attributes || {};
    const normalizedAttrs = {};
    for (const [k, v] of Object.entries(attrs)) {
      if (taskType !== 'text_to_speech' && k === 'default' && v === 'enabled') continue;
      normalizedAttrs[k.toLowerCase().trim()] = normalize(v);
    }

    let count = 0;
    for (const [k, v] of Object.entries(normalizedAttrs)) {
      if (normalizedUser[k] === v) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestMatch = cr;
    }
  }

  return bestMatch || creditRules[0];
}

/**
 * Build the full inner params for create_task.
 * Priority: formDefaults < ruleAttributes < normalizedRuleParams < extraParams (non-rule keys only)
 */
function buildInnerParams(model, taskType, extraParams) {
  const formConfig = model.form_config || [];
  const creditRules = model.credit_rules || [];

  // 1. Resolve virtual params in extraParams
  const resolvedExtra = resolveExtraVirtualParams(formConfig, extraParams);

  // 2. Extract form defaults (virtual resolved with defaults)
  const formDefaults = extractFormDefaults(formConfig);

  // 3. Credit rule selection
  const merged = { ...formDefaults, ...resolvedExtra };
  const validKeys = getValidAttributeKeys(creditRules, taskType);
  const candidateParams = {};
  for (const [k, v] of Object.entries(merged)) {
    if (validKeys.has(k)) candidateParams[k] = v;
  }

  const selectedRule = selectCreditRule(creditRules, candidateParams, taskType);

  // 4. Normalized rule params (canonical values from matched rule)
  const normalizedRuleParams = {};
  if (selectedRule) {
    const ruleAttrs = selectedRule.attributes || {};
    for (const k of validKeys) {
      if (k in ruleAttrs) normalizedRuleParams[k] = ruleAttrs[k];
    }
  }

  // 5. Build inner with correct priority
  const inner = {};
  Object.assign(inner, formDefaults);
  if (selectedRule) Object.assign(inner, selectedRule.attributes || {});
  Object.assign(inner, normalizedRuleParams);
  for (const [k, v] of Object.entries(resolvedExtra)) {
    if (!(k in normalizedRuleParams)) inner[k] = v;
  }

  return { inner, selectedRule, normalizedRuleParams };
}

module.exports = {
  resolveVirtualParam,
  extractFormDefaults,
  resolveExtraVirtualParams,
  getValidAttributeKeys,
  selectCreditRule,
  buildInnerParams,
};
