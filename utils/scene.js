// utils/scene.js
// 场景参数处理工具

/**
 * 将长字符串转换为6位base36短码
 * @param {string} str - 原始字符串
 * @returns {string} 6位base36短码
 */
function encodeToShortCode(str) {
  if (!str) return '';
  
  // 使用简单的hash算法将字符串转换为数字
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  
  // 取绝对值并转换为base36，确保6位长度
  const shortCode = Math.abs(hash).toString(36).padStart(6, '0').slice(-6);
  return shortCode;
}

/**
 * 构建场景参数字符串
 * @param {string} sid - 会话ID (统一参数名)
 * @param {string} token - 邀请令牌 (统一参数名)
 * @returns {string} 场景参数字符串，格式：s=xxxxxx&t=yyyyyy，保证总长 ≤ 32
 */
function buildScene(sid, token) {
  if (!sid || !token) {
    console.warn('[SCENE] buildScene: 缺少必要参数', { sid, token });
    return '';
  }
  
  const shortSid = encodeToShortCode(sid.toString());
  const shortToken = encodeToShortCode(token.toString());
  
  const scene = `s=${shortSid}&t=${shortToken}`;
  
  // 确保场景参数不超过32字符
  if (scene.length > 32) {
    console.warn('[SCENE] 场景参数超过32字符:', scene);
    // 如果超长，截取前32字符
    return scene.substring(0, 32);
  }
  
  console.log('[SCENE] buildScene:', { sid, token, scene });
  return scene;
}

/**
 * 解析场景参数字符串
 * @param {string} scene - 场景参数字符串
 * @returns {object|null} 解析结果 { sid, token } 或 { s, t } 或 null，做参数合法性校验
 */
function parseScene(scene) {
  if (!scene || typeof scene !== 'string') {
    console.warn('[SCENE] parseScene: 无效的scene参数', scene);
    return null;
  }
  
  try {
    const params = {};
    const pairs = scene.split('&');
    
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value) {
        params[key] = decodeURIComponent(value);
      }
    }
    
    // 支持两种格式：s=xxx&t=yyy 或 sid=xxx&token=yyy
    if (params.s && params.t) {
      console.log('[SCENE] parseScene成功(短码):', { scene, result: params });
      return { s: params.s, t: params.t, sid: null, token: null };
    } else if (params.sid && params.token) {
      console.log('[SCENE] parseScene成功(直接):', { scene, result: params });
      return { sid: params.sid, token: params.token, s: null, t: null };
    } else {
      console.warn('[SCENE] parseScene: 缺少必要参数', { scene, params });
      return null;
    }
  } catch (error) {
    console.error('[SCENE] parseScene出错:', error, { scene });
    return null;
  }
}

/**
 * 根据短码查找原始会话ID
 * 这个函数需要访问全局会话数据来进行反向查找
 * @param {string} shortSid - 短会话ID
 * @param {string} shortToken - 短令牌
 * @returns {object|null} {sessionId, inviteToken} 或 null
 */
function findOriginalIds(shortSid, shortToken) {
  try {
    const app = getApp();
    const sessions = app.globalData.sessions || [];
    
    // 遍历所有会话，找到匹配的短码
    for (const session of sessions) {
      const sessionShortCode = encodeToShortCode(session.id.toString());
      const tokenShortCode = encodeToShortCode((session.inviteToken || '').toString());
      
      if (sessionShortCode === shortSid && tokenShortCode === shortToken) {
        console.log('[SCENE] 找到匹配的会话:', {
          shortSid, shortToken,
          sessionId: session.id,
          inviteToken: session.inviteToken
        });
        return {
          sessionId: session.id,
          inviteToken: session.inviteToken
        };
      }
    }
    
    console.warn('[SCENE] 未找到匹配的会话:', { shortSid, shortToken });
    return null;
  } catch (error) {
    console.error('[SCENE] findOriginalIds出错:', error);
    return null;
  }
}

module.exports = {
  buildScene,
  parseScene,
  findOriginalIds,
  encodeToShortCode
};
