/**
 * 微信小程序码前端适配器
 * 实现二层降级机制：云函数 → 文本入局码
 */

import { getWxacodeError, isRetryableError, isConfigError } from '../../tools/wxacode.error-map';

// 类型定义
export interface WxacodeRequest {
  sessionId: string;
  token: string;
  page?: string;
  envVersion?: 'release' | 'trial' | 'develop';
}

export interface WxacodeResponse {
  url?: string;                    // 成功时的小程序码URL
  fallback?: 'code';               // 降级类型
  fromCache: boolean;              // 是否来自缓存
  error?: string;                  // 错误信息
  errorCode?: string;              // 错误码
}

export interface WxacodeCache {
  url: string;
  expireAt: number;
  createAt: number;
}

// 配置常量
const CONFIG = {
  CACHE_EXPIRE: 7 * 24 * 60 * 60 * 1000, // 7天缓存
  MAX_RETRY: 3,                           // 最大重试次数
  RETRY_DELAYS: [100, 300, 700],          // 重试延迟（毫秒）
  DEFAULT_PAGE: 'pages/session/join/index' // 默认页面路径
};

/**
 * 获取小程序码（主入口函数）
 */
export async function getMiniProgramCode(
  sessionId: string, 
  token: string, 
  options: Partial<WxacodeRequest> = {}
): Promise<WxacodeResponse> {
  const request: WxacodeRequest = {
    sessionId,
    token,
    page: options.page || CONFIG.DEFAULT_PAGE,
    envVersion: options.envVersion || 'release'
  };

  try {
    // 1. 检查本地缓存
    const cachedResult = await checkLocalCache(sessionId, token);
    if (cachedResult) {
      console.log('命中本地缓存:', cachedResult);
      return {
        url: cachedResult.url,
        fromCache: true
      };
    }

    // 2. 尝试云函数生成
    const cloudResult = await tryCloudFunction(request);
    if (cloudResult.ok) {
      // 缓存成功结果
      await setLocalCache(sessionId, token, cloudResult.url);
      return {
        url: cloudResult.url,
        fromCache: false
      };
    }

    // 3. 根据错误类型决定降级策略
    return await handleFallback(request, cloudResult);

  } catch (error) {
    console.error('小程序码获取失败:', error);
    return await handleFallback(request, { 
      ok: false, 
      code: 'INTERNAL_ERROR', 
      message: error.message 
    });
  }
}

/**
 * 检查本地缓存
 */
async function checkLocalCache(sessionId: string, token: string): Promise<WxacodeCache | null> {
  try {
    const cacheKey = `wxacode:${sessionId}:${token}`;
    const cached = wx.getStorageSync(cacheKey);
    
    if (!cached) return null;
    
    const cache: WxacodeCache = JSON.parse(cached);
    if (Date.now() > cache.expireAt) {
      // 缓存过期，删除
      wx.removeStorageSync(cacheKey);
      return null;
    }
    
    return cache;
  } catch (error) {
    console.error('缓存检查失败:', error);
    return null;
  }
}

/**
 * 设置本地缓存
 */
async function setLocalCache(sessionId: string, token: string, url: string): Promise<void> {
  try {
    const cacheKey = `wxacode:${sessionId}:${token}`;
    const cache: WxacodeCache = {
      url,
      expireAt: Date.now() + CONFIG.CACHE_EXPIRE,
      createAt: Date.now()
    };
    
    wx.setStorageSync(cacheKey, JSON.stringify(cache));
  } catch (error) {
    console.error('缓存设置失败:', error);
  }
}

/**
 * 尝试云函数生成
 */
async function tryCloudFunction(request: WxacodeRequest): Promise<any> {
  let lastError: any = null;
  
  for (let attempt = 0; attempt < CONFIG.MAX_RETRY; attempt++) {
    try {
      console.log(`尝试云函数调用 (第${attempt + 1}次):`, request);
      
      // 简单短码（base36）
      const short = (s = '') => {
        try { return Math.abs([...s].reduce((h,c)=> (h*131 + c.charCodeAt(0))|0, 0)).toString(36).slice(0,8); }
        catch { return (Date.now()%1e7).toString(36); }
      };

      // 安全 scene：只含 0-9a-zA-Z.-_，长度≤32
      const buildScene = (sid, token) => {
        const s1 = short(sid);
        const s2 = short(token);
        const scene = `${s1}.${s2}`; // 例如 "k3f1a2.b9c8d0"（去掉 & 和 =）
        return scene.slice(0, 32);
      };

      const getEnvVersion = () => {
        try {
          return (wx.getAccountInfoSync && wx.getAccountInfoSync().miniProgram.envVersion) || 'release';
        } catch { return 'release'; }
      };
      const envVer = getEnvVersion();
      const requestedEnvVersion = (envVer === 'release') ? 'release' : 'trial';

      const scene = buildScene(request.sessionId, request.token);

      const result = await wx.cloud.callFunction({
        name: 'wxacode',
        data: {
          page: request.page || 'pages/invite/join/index',
          scene,
          requestedEnvVersion,
          checkPath: false,
          sid: short(request.sessionId),
          token: short(request.token),
          storage: true
        }
      });

      console.log('[SHARE] requestedEnvVersion =', requestedEnvVersion,
                  'path =', `/pages/invite/join/index?sid=${request.sessionId}&token=${request.token}`);
      
      console.log('云函数调用成功:', result);
      return result.result;
      
    } catch (error) {
      lastError = error;
      console.error(`云函数调用失败 (第${attempt + 1}次):`, error);
      
      // 如果不是可重试的错误，直接退出
      if (result?.result?.code && !isRetryableError(result.result.code)) {
        return result.result;
      }
      
      // 等待重试延迟
      if (attempt < CONFIG.MAX_RETRY - 1) {
        const delay = CONFIG.RETRY_DELAYS[attempt] || 1000;
        await sleep(delay);
      }
    }
  }
  
  // 所有重试都失败了
  return {
    ok: false,
    code: 'MAX_RETRY_EXCEEDED',
    message: `重试${CONFIG.MAX_RETRY}次后仍然失败: ${lastError?.message || '未知错误'}`
  };
}

/**
 * 处理降级策略
 */
async function handleFallback(request: WxacodeRequest, cloudResult: any): Promise<WxacodeResponse> {
  const { code, message } = cloudResult;
  
  // 记录失败埋点
  reportWxacodeFail(code, message);
  
  // 根据错误类型选择降级策略
  if (isConfigError(code)) {
    // 配置错误，降级到文本入局码
    console.log('配置错误，降级到文本入局码');
    reportWxacodeFallback('code');
    return {
      fallback: 'code',
      fromCache: false,
      error: message,
      errorCode: code
    };
  }
  
  // 其他错误，直接降级到文本入局码
  console.log('小程序码生成失败，降级到文本入局码');
  reportWxacodeFallback('code');
  return {
    fallback: 'code',
    fromCache: false,
    error: '小程序码生成失败，请使用文本入局码',
    errorCode: 'ALL_FALLBACK_FAILED'
  };
}



/**
 * 睡眠函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 埋点：小程序码成功
 */
function reportWxacodeSuccess(sessionId: string, fromCache: boolean): void {
  try {
    wx.reportAnalytics('wxacode_success', {
      sid: sessionId,
      fromCache: fromCache ? 1 : 0
    });
  } catch (error) {
    console.error('埋点上报失败:', error);
  }
}

/**
 * 埋点：小程序码失败
 */
function reportWxacodeFail(code: string, message: string): void {
  try {
    wx.reportAnalytics('wxacode_fail', {
      code,
      message: message.substring(0, 100) // 限制长度
    });
  } catch (error) {
    console.error('埋点上报失败:', error);
  }
}

/**
 * 埋点：小程序码降级
 */
function reportWxacodeFallback(type: 'code'): void {
  try {
    wx.reportAnalytics('wxacode_fallback', {
      type
    });
  } catch (error) {
    console.error('埋点上报失败:', error);
  }
}

/**
 * 清除缓存
 */
export async function clearWxacodeCache(sessionId?: string, token?: string): Promise<void> {
  try {
    if (sessionId && token) {
      // 清除特定缓存
      const cacheKey = `wxacode:${sessionId}:${token}`;
      wx.removeStorageSync(cacheKey);
    } else {
      // 清除所有小程序码缓存
      const keys = wx.getStorageInfoSync().keys;
      keys.forEach(key => {
        if (key.startsWith('wxacode:')) {
          wx.removeStorageSync(key);
        }
      });
    }
    console.log('缓存清除成功');
  } catch (error) {
    console.error('缓存清除失败:', error);
  }
}

/**
 * 获取缓存统计
 */
export function getWxacodeCacheStats(): { total: number; expired: number; valid: number } {
  try {
    const keys = wx.getStorageInfoSync().keys;
    const wxacodeKeys = keys.filter(key => key.startsWith('wxacode:'));
    
    let expired = 0;
    let valid = 0;
    
    wxacodeKeys.forEach(key => {
      try {
        const cached = wx.getStorageSync(key);
        if (cached) {
          const cache = JSON.parse(cached);
          if (Date.now() > cache.expireAt) {
            expired++;
          } else {
            valid++;
          }
        }
      } catch (error) {
        expired++;
      }
    });
    
    return {
      total: wxacodeKeys.length,
      expired,
      valid
    };
  } catch (error) {
    console.error('缓存统计失败:', error);
    return { total: 0, expired: 0, valid: 0 };
  }
}

