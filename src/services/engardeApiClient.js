const axios = require('axios');
const config = require('../config');
const logger = require('../config/logger');

/**
 * Authenticated client for En Garde's public API v1 (bearer access token).
 * Paths are relative to ENGARDE_API_URL, e.g. '/api/v1/campaigns'
 * (contract mirrored from engarde-api app/api/v1/endpoints/*).
 */
class EngardeApiClient {
  constructor() {
    this.baseURL = config.ENGARDE_API_URL;
  }

  async request(method, path, accessToken, { params, data } = {}) {
    try {
      const res = await axios({
        method,
        url: `${this.baseURL}${path}`,
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
        data,
        timeout: 15000
      });
      return res.data;
    } catch (err) {
      const status = err.response?.status || 502;
      const detail = err.response?.data?.detail || err.response?.data || err.message;
      logger.error(`En Garde API ${method.toUpperCase()} ${path} failed`, { status, detail });
      const wrapped = new Error(
        typeof detail === 'string' ? detail : `En Garde API request failed (${status})`
      );
      wrapped.status = status;
      throw wrapped;
    }
  }

  get(path, accessToken, params) {
    return this.request('get', path, accessToken, { params });
  }
  post(path, accessToken, data) {
    return this.request('post', path, accessToken, { data });
  }
  /**
   * Multipart upload passthrough (US-3.1.3). `file` is a multer memory-storage
   * file ({ buffer, originalname, mimetype }); `fields` are extra form fields.
   */
  postMultipart(path, accessToken, file, fields = {}) {
    const form = new FormData();
    form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
    for (const [key, value] of Object.entries(fields)) {
      if (value != null && value !== '') form.append(key, value);
    }
    return this.request('post', path, accessToken, { data: form });
  }
  patch(path, accessToken, data) {
    return this.request('patch', path, accessToken, { data });
  }
  del(path, accessToken) {
    return this.request('delete', path, accessToken);
  }
}

module.exports = new EngardeApiClient();
