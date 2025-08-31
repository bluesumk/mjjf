const cloud = require('wx-server-sdk');
cloud.init({ env: 'cloudbase-3go6h0x7b3bc5b04' });

const log = (...args) => console.log('[wxacode]', ...args);

exports.main = async (event = {}) => {
  const {
    page = 'pages/invite/join/index',
    scene = '',
    checkPath = false,
    requestedEnvVersion = 'trial', // 前端传入
    sid = 's',
    token = 't',
    width = 430,
    // 可选：仅调试时不落库，直接返回 base64
    storage = true
  } = event;

  // 仅允许 release | trial，其他（含 develop）一律改为 trial
  const envVersion = (requestedEnvVersion === 'release') ? 'release' : 'trial';
  console.log('[wxacode] envVersion =', envVersion, 'page =', page, 'scene =', scene);

  // —— 放大入参日志 —— //
  log('input', { page, scene, checkPath, envVersion, sid, token, width, storage });

  const uploadAndSign = async (buf, prefix = '') => {
    const cloudPath = `wxacode/${prefix}${sid}-${token}-${Date.now()}.png`;
    const up = await cloud.uploadFile({ cloudPath, fileContent: buf });
    const { fileList } = await cloud.getTempFileURL({ fileList: [up.fileID] });
    const url = (fileList && fileList[0] && fileList[0].tempFileURL) || '';
    return { fileID: up.fileID, url };
  };

  try {
    // 1) 首选：getUnlimited
    const resp = await cloud.openapi.wxacode.getUnlimited({
      page, scene, checkPath, envVersion, width
    });
    const buf = Buffer.from(resp.buffer);

    if (!storage) {
      const base64 = 'data:image/png;base64,' + buf.toString('base64');
      return { ok: true, page, scene, base64, via: 'getUnlimited' };
    }
    const { fileID, url } = await uploadAndSign(buf);
    return { ok: true, page, scene, url, fileID, via: 'getUnlimited' };

  } catch (e) {
    log('getUnlimited failed', e, e.errCode, e.errMsg);

    // 2) 兜底：createQRCode（使用 path=page?scene）
    try {
      const path = `${page}?${scene}`;
      const resp2 = await cloud.openapi.wxacode.createQRCode({ path, width });
      const buf2 = Buffer.from(resp2.buffer);

      if (!storage) {
        const base64 = 'data:image/png;base64,' + buf2.toString('base64');
        return {
          ok: true, page, scene, base64,
          via: 'createQRCode', reason: { code: e.errCode || e.code, msg: e.errMsg || e.message }
        };
      }
      const { fileID, url } = await uploadAndSign(buf2, 'fallback-');
      return {
        ok: true, page, scene, url, fileID,
        via: 'createQRCode', reason: { code: e.errCode || e.code, msg: e.errMsg || e.message }
      };

    } catch (e2) {
      log('createQRCode failed', e2, e2.errCode, e2.errMsg);
      return {
        ok: false,
        error: {
          code: e2.errCode || e2.code || 'E_UNKNOWN',
          msg: e2.errMsg || e2.message || 'wxacode failed'
        }
      };
    }
  }
};