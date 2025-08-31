const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloudbase-3go6h0x7b3bc5b04' });
exports.main = async () => ({ ok: true, ts: Date.now() });