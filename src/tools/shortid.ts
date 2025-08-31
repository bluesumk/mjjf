/**
 * 短码工具函数
 * 解决微信小程序码 scene 参数≤32字符限制
 */

/**
 * 简单稳定的 6 位 base36 短码：对任意字符串做 rolling-hash→base36→取末 6 位
 */
export const toBase36_6 = (input: string | number): string => {
  const s = String(input);
  let h = 2166136261 >>> 0;           // FNV-1a 起点
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0; // 32bit 乘法
  }
  return h.toString(36).slice(-6).padStart(6, '0'); // 始终 6 位
};

/**
 * 组装 scene：s,t 总长约 13 字符，满足 ≤32 的要求
 */
export const buildScene = (sid: string, token: string): string => {
  const s = toBase36_6(sid);
  const t = toBase36_6(token);
  return `s=${s}&t=${t}`;
};

/**
 * 解析 scene 参数
 */
export const parseScene = (scene: string): { s: string; t: string } | null => {
  try {
    const params = new URLSearchParams(scene);
    const s = params.get('s');
    const t = params.get('t');
    
    if (!s || !t) return null;
    
    return { s, t };
  } catch (error) {
    console.error('解析scene失败:', error);
    return null;
  }
};

/**
 * 缓存映射类型定义（用于落地页从短码反查原始 id）
 * 实际项目里建议放到云数据库；这里仅提供接口定义
 */
export type InviteMap = { 
  s: string; 
  t: string; 
  sid: string; 
  token: string; 
  ts: number 
};

