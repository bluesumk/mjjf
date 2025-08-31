// store/featureFlags.js
/**
 * 功能开关管理
 * 用于控制新功能的启用/禁用状态
 */

// 默认配置
const defaultFeatureFlags = {
  // 功能开关配置
};

/**
 * 获取功能开关状态
 * @param {string} key 开关键名
 * @returns {boolean} 开关状态
 */
function getFeatureFlag(key) {
  try {
    const flags = wx.getStorageSync('featureFlags') || defaultFeatureFlags;
    return flags[key] !== undefined ? flags[key] : defaultFeatureFlags[key];
  } catch (error) {
    console.warn('获取功能开关失败:', error);
    return defaultFeatureFlags[key];
  }
}

/**
 * 设置功能开关状态
 * @param {string} key 开关键名
 * @param {boolean} value 开关值
 */
function setFeatureFlag(key, value) {
  try {
    const flags = wx.getStorageSync('featureFlags') || defaultFeatureFlags;
    flags[key] = value;
    wx.setStorageSync('featureFlags', flags);
  } catch (error) {
    console.warn('设置功能开关失败:', error);
  }
}

module.exports = {
  getFeatureFlag,
  setFeatureFlag
};
