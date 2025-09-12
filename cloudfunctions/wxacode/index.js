const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, traceUser: true });

const db = cloud.database();
const cacheCollection = db.collection('wxacode_cache');
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

  // 动态设定环境版本，支持正式部署
  const envVersion = (requestedEnvVersion === 'release') ? 'release' : 
                     (requestedEnvVersion === 'develop') ? 'develop' : 'trial';
  console.log('[wxacode] envVersion =', envVersion, 'page =', page, 'scene =', scene);

  // —— 放大入参日志 —— //
  log('input', { page, scene, checkPath, envVersion, sid, token, width, storage });

  // 缓存检查
  // 注意：scene 可能为 "s=xxxx&t=yyyy" 或 "xxxx.yyyy"，缓存键统一用 sid-token（短码）
  const cacheKey = `${sid}-${token}`;
  try {
    const cached = await cacheCollection.doc(cacheKey).get();
    if (cached.data && cached.data.expireTime > new Date()) {
      log('cache hit', cacheKey);
      return { 
        ok: true, 
        url: cached.data.url,
        base64: cached.data.base64,
        via: 'cache',
        fromCache: true
      };
    }
  } catch (e) {
    log('cache miss', cacheKey);
  }

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
      
      // 缓存 base64 结果
      try {
        await cacheCollection.doc(cacheKey).set({
          data: {
            base64,
            expireTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时过期
            createdAt: new Date(),
            sid,
            token
          }
        });
        log('cached base64', cacheKey);
      } catch (cacheError) {
        log('cache save failed', cacheError);
      }
      
      return { ok: true, page, scene, base64, via: 'getUnlimited' };
    }
    
    const { fileID, url } = await uploadAndSign(buf);
    
    // 缓存 URL 结果
    try {
      await cacheCollection.doc(cacheKey).set({
        data: {
          url,
          fileID,
          expireTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时过期
          createdAt: new Date(),
          sid,
          token
        }
      });
      log('cached url', cacheKey);
    } catch (cacheError) {
      log('cache save failed', cacheError);
    }
    
    return { ok: true, page, scene, url, fileID, via: 'getUnlimited' };

  } catch (e) {
    log('getUnlimited failed', e, e.errCode, e.errMsg);

    // 2) 兜底：createQRCode（使用 path=page?scene），同样遵循 storage 标志
    try {
      const path = `${page}?${scene}`;
      const resp2 = await cloud.openapi.wxacode.createQRCode({ path, width });
      const buf2 = Buffer.from(resp2.buffer);

      if (!storage) {
        const base64 = 'data:image/png;base64,' + buf2.toString('base64');
        // 缓存 base64 结果
        try {
          await cacheCollection.doc(cacheKey).set({
            data: {
              base64,
              expireTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
              createdAt: new Date(),
              sid,
              token
            }
          });
          log('cached base64 (fallback)', cacheKey);
        } catch (cacheError) {
          log('cache save failed (fallback)', cacheError);
        }
        return { ok: true, page, scene, base64, via: 'createQRCode', reason: { code: e.errCode || e.code, msg: e.errMsg || e.message } };
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