'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.imastudio');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CACHE_DIR = path.join(CONFIG_DIR, 'cache');

/**
 * Get API key from (in priority order):
 * 1. --api-key CLI flag
 * 2. IMA_API_KEY environment variable
 * 3. ~/.imastudio/credentials file
 */
function getApiKey(cmdOpts) {
  // 1. CLI flag (from parent command or direct)
  const root = cmdOpts?.parent || cmdOpts;
  if (root?.apiKey) return root.apiKey;

  // 2. Environment variable
  if (process.env.IMA_API_KEY) return process.env.IMA_API_KEY;

  // 3. Credentials file
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const content = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
      const match = content.match(/api_key\s*=\s*(.+)/);
      if (match) return match[1].trim();
    }
  } catch {
    // ignore read errors
  }

  return null;
}

/**
 * Require API key or exit with helpful message
 */
function requireApiKey(cmdOpts) {
  const key = getApiKey(cmdOpts);
  if (!key) {
    console.error('Error: No API key found.\n');
    console.error('Set your API key using one of:');
    console.error('  1. ima init                          (interactive setup)');
    console.error('  2. export IMA_API_KEY=ima_xxx        (environment variable)');
    console.error('  3. ima --api-key ima_xxx <command>   (per-command)\n');
    console.error('Get your API key at: https://imastudio.com');
    process.exit(1);
  }
  return key;
}

/**
 * Get base URL
 */
function getBaseUrl(cmdOpts) {
  const root = cmdOpts?.parent || cmdOpts;
  return root?.baseUrl || process.env.IMA_BASE_URL || 'https://api.imastudio.com';
}

/**
 * Load user config
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return {};
}

/**
 * Save user config
 */
function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n');
}

/**
 * Save API key to credentials file
 */
function saveApiKey(apiKey) {
  ensureConfigDir();
  fs.writeFileSync(CREDENTIALS_FILE, `api_key = ${apiKey}\n`, { mode: 0o600 });
}

/**
 * Ensure config directory exists
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  ensureConfigDir();
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Read from cache (returns null if expired or missing)
 */
function readCache(key, maxAgeMs = 3600000) {
  try {
    const file = path.join(CACHE_DIR, `${key}.json`);
    if (!fs.existsSync(file)) return null;
    const stat = fs.statSync(file);
    if (Date.now() - stat.mtimeMs > maxAgeMs) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Write to cache
 */
function writeCache(key, data) {
  ensureCacheDir();
  const file = path.join(CACHE_DIR, `${key}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = {
  CONFIG_DIR,
  CREDENTIALS_FILE,
  CONFIG_FILE,
  CACHE_DIR,
  getApiKey,
  requireApiKey,
  getBaseUrl,
  loadConfig,
  saveConfig,
  saveApiKey,
  ensureConfigDir,
  ensureCacheDir,
  readCache,
  writeCache,
};
