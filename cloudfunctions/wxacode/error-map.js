/**
 * 微信 openapi/云函数常见错误 → 统一业务错误码 + 友好文案
 */

/**
 * 微信 openapi/云函数常见错误 → 统一业务错误码 + 友好文案
 */
const wxacodeErrorToCode = (err) => {
  const msg = (err?.errmsg || err?.message || '').toLowerCase();
  const code = Number(err?.errcode);

  if (msg.includes('invalid page') || msg.includes('page not found')) return 'INVALID_PAGE';
  if (msg.includes('scene') && msg.includes('too long')) return 'SCENE_TOO_LONG';
  if (msg.includes('scene') && msg.includes('invalid')) return 'SCENE_INVALID';
  if (msg.includes('permission') || code === 200011) return 'NO_PERMISSION';
  if (msg.includes('frequency') || msg.includes('limit')) return 'RATE_LIMITED';
  if (msg.includes('network') || code === 1001) return 'NETWORK_ERROR';
  if (code === -1 || msg.includes('system error')) return 'SYSTEM_ERROR';
  return 'UNKNOWN';
};

const codeToUserMessage = (c) => {
  switch (c) {
    case 'INVALID_PAGE':
      return '页面路径不可用，请确认已发布且 page 不带问号 ?';
    case 'SCENE_TOO_LONG':
      return '入局参数超长，已自动缩短后重试或请稍后再试';
    case 'SCENE_INVALID':
      return '入局参数格式不正确';
    case 'NO_PERMISSION':
      return '当前环境/账号权限不足，请检查云环境与 AppID 绑定';
    case 'RATE_LIMITED':
      return '生成过于频繁，请稍后再试';
    case 'NETWORK_ERROR':
      return '网络异常，请检查网络后重试';
    case 'SYSTEM_ERROR':
      return '系统繁忙，请稍后再试';
    default:
      return '生成失败，请稍后再试';
  }
};

module.exports = {
  wxacodeErrorToCode,
  codeToUserMessage
};

