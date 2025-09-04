/**
 * 网络请求工具类
 * 统一处理loading、错误提示等
 */
const config = require('../config.js');

class RequestManager {
  /**
   * 调用云函数（带loading和错误处理）
   */
  static async callCloudFunction(name, data = {}, options = {}) {
    const {
      showLoading = true,
      loadingTitle = '请稍候...',
      showError = true,
      timeout = config.request.timeout
    } = options;

    if (showLoading) {
      wx.showLoading({ 
        title: loadingTitle,
        mask: true 
      });
    }

    try {
      const res = await wx.cloud.callFunction({
        name,
        data,
        timeout
      });

      if (showLoading) {
        wx.hideLoading();
      }

      return res;
    } catch (error) {
      if (showLoading) {
        wx.hideLoading();
      }

      console.error(`[CloudFunction] ${name} 调用失败:`, error);

      if (showError) {
        let errorMsg = '网络异常，请稍后重试';
        
        if (error.errCode === -1) {
          errorMsg = '网络连接失败';
        } else if (error.errMsg && error.errMsg.includes('timeout')) {
          errorMsg = '请求超时，请重试';
        } else if (error.errMsg && error.errMsg.includes('permission')) {
          errorMsg = '权限不足';
        }

        wx.showToast({
          icon: 'none',
          title: errorMsg,
          duration: 2000
        });
      }

      throw error;
    }
  }

  /**
   * 获取用户授权信息
   */
  static async getUserProfile(desc = '用于显示头像与昵称') {
    return new Promise((resolve, reject) => {
      if (!wx.getUserProfile) {
        reject(new Error('当前微信版本不支持getUserProfile'));
        return;
      }

      wx.getUserProfile({
        desc,
        success: resolve,
        fail: reject
      });
    });
  }

  /**
   * 复制到剪贴板
   */
  static async copyToClipboard(data, successMsg = '已复制到剪贴板') {
    try {
      await wx.setClipboardData({ data });
      
      wx.showToast({
        title: successMsg,
        icon: 'success',
        duration: 1500
      });
      
      return true;
    } catch (error) {
      console.error('[Clipboard] 复制失败:', error);
      
      wx.showToast({
        icon: 'none',
        title: '复制失败',
        duration: 2000
      });
      
      return false;
    }
  }

  /**
   * 显示成功提示
   */
  static showSuccess(title, duration = 1500) {
    wx.showToast({
      title,
      icon: 'success',
      duration
    });
  }

  /**
   * 显示错误提示
   */
  static showError(title, duration = 2000) {
    wx.showToast({
      icon: 'none',
      title,
      duration
    });
  }

  /**
   * 显示加载中
   */
  static showLoading(title = '加载中...') {
    wx.showLoading({
      title,
      mask: true
    });
  }

  /**
   * 隐藏加载
   */
  static hideLoading() {
    wx.hideLoading();
  }

  /**
   * 重试机制
   */
  static async retry(fn, times = config.request.retryTimes, delay = 1000) {
    for (let i = 0; i < times; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === times - 1) {
          throw error;
        }
        
        console.warn(`[Retry] 第${i + 1}次重试失败, ${delay}ms后重试:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}

module.exports = RequestManager;

