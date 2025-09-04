/**
 * 邀请码生成工具
 * 生成稳定的6位邀请码和scene参数
 */

/**
 * 简单稳定的 6 位 base36 短码：对任意字符串做 rolling-hash→base36→取末 6 位
 * @param {string|number} input - 输入字符串或数字
 * @returns {string} 6位base36短码
 */
const toBase36_6 = (input) => {
  const s = String(input);
  let h = 2166136261 >>> 0;           // FNV-1a 起点
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0; // 32bit 乘法
  }
  return h.toString(36).slice(-6).padStart(6, '0'); // 始终 6 位
};

/**
 * 生成6位邀请码（稳定可复现）
 * @param {string} sid - 会话ID
 * @param {string} token - 邀请令牌
 * @returns {string} 6位邀请码
 */
const generateInviteCode = (sid, token) => {
  try {
    if (!sid || !token) {
      console.warn('generateInviteCode: 参数缺失', { sid, token });
      return '000000'; // 默认值
    }
    
    const s6 = toBase36_6(sid);
    const t6 = toBase36_6(token);
    return s6 + t6; // 12位，但实际使用中通常只显示前6位
  } catch (error) {
    console.error('generateInviteCode 生成失败:', error);
    return '000000'; // 异常时的默认值
  }
};

/**
 * 组装 scene：s,t 总长约 13 字符，满足 ≤32 的要求
 * @param {string} sid - 会话ID
 * @param {string} token - 邀请令牌
 * @returns {string} scene参数
 */
const buildScene = (sid, token) => {
  try {
    if (!sid || !token) {
      console.warn('buildScene: 参数缺失', { sid, token });
      return 's=000000&t=000000'; // 默认值
    }
    
    const s = toBase36_6(sid);
    const t = toBase36_6(token);
    return `s=${s}&t=${t}`; // 格式：s=xxxxxx&t=yyyyyy
  } catch (error) {
    console.error('buildScene 生成失败:', error);
    return 's=000000&t=000000'; // 异常时的默认值
  }
};

/**
 * 解析 scene 参数
 * @param {string} scene - scene参数字符串
 * @returns {Object|null} 解析结果 { s: string, t: string }
 */
const parseScene = (scene) => {
  try {
    if (!scene) return null;
    
    // 手写解析，兼容低版本基础库
    const res = {};
    scene.split('&').forEach(kv => {
      const i = kv.indexOf('=');
      if (i > 0) {
        const k = kv.slice(0, i);
        const v = kv.slice(i + 1);
        res[k] = v;
      }
    });
    
    const s = res.s;
    const t = res.t;
    
    if (!s || !t) return null;
    
    return { s, t };
  } catch (error) {
    console.error('解析scene失败:', error);
    return null;
  }
};

// CommonJS 导出（兼容现有代码）
module.exports = {
  toBase36_6,
  generateInviteCode,
  buildScene,
  parseScene
};
