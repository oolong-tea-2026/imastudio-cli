'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'x-app-source': 'ima_cli',
  'x_app_language': 'en',
};

/**
 * Make an HTTP request (pure Node.js, no dependencies)
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const proto = parsed.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        ...DEFAULT_HEADERS,
        ...options.headers,
      },
    };

    const req = proto.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.code !== 200 && data.code !== 0) {
            reject(new ApiError(data.message || 'API error', data.code, data));
          } else {
            resolve(data);
          }
        } catch {
          reject(new Error(`Invalid JSON response: ${body.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(options.timeout || 30000, () => {
      req.destroy(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

class ApiError extends Error {
  constructor(message, code, data) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.data = data;
  }
}

/**
 * IMA API client
 */
class ImaClient {
  constructor(apiKey, baseUrl = 'https://api.imastudio.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  get authHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  /**
   * GET request
   */
  async get(path, params = {}) {
    const url = new URL(path, this.baseUrl);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
    return request(url.toString(), { headers: this.authHeaders });
  }

  /**
   * POST request
   */
  async post(path, body = {}, options = {}) {
    const url = new URL(path, this.baseUrl);
    return request(url.toString(), {
      method: 'POST',
      headers: this.authHeaders,
      body,
      ...options,
    });
  }

  /**
   * List products (models) for a task type
   */
  async listProducts(category) {
    const res = await this.get('/open/v1/product/list', {
      app: 'ima',
      platform: 'web',
      category,
    });
    return res.data || [];
  }

  /**
   * Create a task
   */
  async createTask(payload) {
    const res = await this.post('/open/v1/tasks/create', payload);
    return res.data;
  }

  /**
   * Get task detail
   */
  async getTaskDetail(taskId) {
    const res = await this.post('/open/v1/tasks/detail', { task_id: taskId });
    return res.data;
  }

  /**
   * Verify an asset for compliance.
   * The API is synchronous but may take up to 5 minutes.
   *
   * @param {string} assetUrl  CDN URL of the uploaded asset
   * @param {string} [name]    Optional display name (max 64 chars)
   * @returns {{ id: string, status: string, asset_type: string, error?: { code: string, message: string } }}
   */
  async verifyAsset(assetUrl, name) {
    const body = { url: assetUrl };
    if (name) body.name = name.slice(0, 64);
    const res = await this.post('/open/v1/assets/verify', body, { timeout: 300000 });
    return (res.data && res.data.result) || {};
  }
}

/**
 * Upload file to IMA CDN via presigned URL
 */
async function uploadToOss(fileBuffer, mimeType, apiKey, baseImUrl = 'https://imapi.liveme.com') {
  const suffix = mimeType.split('/')[1] || 'jpeg';

  // Step 1: Get upload token
  const tokenUrl = new URL('/api/rest/oss/getuploadtoken', baseImUrl);
  tokenUrl.searchParams.set('suffix', suffix);
  tokenUrl.searchParams.set('content_type', mimeType);
  tokenUrl.searchParams.set('uid', '0');

  const tokenRes = await request(tokenUrl.toString(), {
    headers: {
      'ima-token': apiKey,
      'APP-KEY': 'im_claw_open',
    },
  });

  if (!tokenRes.data?.ful) {
    throw new Error('Failed to get upload token');
  }

  const { ful, fdl } = tokenRes.data;

  // Step 2: Upload to presigned URL
  await new Promise((resolve, reject) => {
    const parsed = new URL(ful);
    const proto = parsed.protocol === 'https:' ? https : http;
    const req = proto.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
          'Content-Length': fileBuffer.length,
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
          else reject(new Error(`Upload failed: ${res.statusCode} ${body.substring(0, 200)}`));
        });
      }
    );
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });

  return fdl; // CDN URL
}

module.exports = { request, ImaClient, ApiError, uploadToOss };
