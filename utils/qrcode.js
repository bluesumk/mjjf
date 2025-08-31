/**
 * 邀请码生成工具
 * 仅保留文本邀请码生成，移除Canvas二维码降级
 */

/**
 * 生成邀请令牌
 * @returns {string} 8位随机令牌
 */
function generateInviteToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成会话ID
 * @returns {string} 基于时间戳的会话ID
 */
function generateSessionId() {
  return Date.now().toString();
}

module.exports = {
  generateInviteToken,
  generateSessionId
};


