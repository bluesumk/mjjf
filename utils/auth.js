/**
 * 微信授权登录工具模块
 */

const AUTH_STORAGE_KEY = 'userAuth';
const USER_INFO_STORAGE_KEY = 'userInfo';

/**
 * 用户认证管理器
 */
class AuthManager {
  constructor() {
    this.userInfo = null;
    this.isLoggedIn = false;
    this.loadUserInfo();
  }

  /**
   * 执行微信登录流程（首页调用）
   */
  async login() {
    try {
      console.log('开始微信登录流程...');
      
      // 1. 获取微信登录凭证
      const loginResult = await this.wxLogin();
      if (!loginResult.success) {
        throw new Error('微信登录失败: ' + loginResult.error);
      }

      // 2. 检查是否已有用户信息
      const existingUserInfo = this.getUserInfo();
      if (existingUserInfo && existingUserInfo.nickName && !existingUserInfo.isDefault) {
        console.log('发现已存储的真实用户信息，直接使用');
        this.isLoggedIn = true;
        return {
          success: true,
          userInfo: existingUserInfo,
          fromCache: true
        };
      }

      // 3. 首次用户或需要重新授权，返回需要授权状态
      return {
        success: false,
        needAuth: true,
        code: loginResult.code,
        message: '需要用户授权才能使用小程序'
      };

    } catch (error) {
      console.error('登录流程异常:', error);
      
      return {
        success: false,
        needAuth: true,
        error: error.message
      };
    }
  }

  /**
   * 请求用户授权（标准微信授权流程）
   */
  async requestUserAuth() {
    try {
      console.log('开始请求用户授权...');
      
      // 使用微信标准授权API
      const userInfo = await this.getUserProfileStandard();
      if (userInfo.success) {
        // 标记为真实用户信息
        userInfo.userInfo.isDefault = false;
        this.saveUserInfo(userInfo.userInfo);
        this.isLoggedIn = true;
        
        return {
          success: true,
          userInfo: userInfo.userInfo
        };
      } else {
        // 用户拒绝授权，使用默认信息
        console.log('用户拒绝授权，使用默认用户信息');
        const defaultUserInfo = this.createDefaultUserInfo();
        this.saveUserInfo(defaultUserInfo);
        this.isLoggedIn = true;
        
        return {
          success: true,
          userInfo: defaultUserInfo,
          isDefault: true,
          message: '使用默认身份，可稍后在"我的"页面更新'
        };
      }
    } catch (error) {
      console.error('用户授权失败:', error);
      
      // 降级到默认用户
      const defaultUserInfo = this.createDefaultUserInfo();
      this.saveUserInfo(defaultUserInfo);
      this.isLoggedIn = true;
      
      return {
        success: true,
        userInfo: defaultUserInfo,
        isDefault: true,
        error: error.message
      };
    }
  }

  /**
   * 微信登录获取code
   */
  wxLogin() {
    return new Promise((resolve) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            console.log('微信登录成功，code:', res.code);
            resolve({ success: true, code: res.code });
          } else {
            console.error('微信登录失败:', res.errMsg);
            resolve({ success: false, error: res.errMsg });
          }
        },
        fail: (error) => {
          console.error('微信登录调用失败:', error);
          resolve({ success: false, error: error.errMsg || '登录失败' });
        }
      });
    });
  }

  /**
   * 获取用户信息（标准微信授权）
   */
  getUserProfileStandard() {
    return new Promise((resolve) => {
      if (wx.getUserProfile) {
        wx.getUserProfile({
          desc: '用于显示用户头像和昵称',
          success: (res) => {
            console.log('获取用户信息成功:', res.userInfo);
            resolve({ success: true, userInfo: res.userInfo });
          },
          fail: (error) => {
            console.log('用户拒绝授权或获取失败:', error);
            resolve({ success: false, error: error.errMsg || '获取用户信息失败' });
          }
        });
      } else {
        // 降级方案
        console.log('当前版本不支持getUserProfile');
        resolve({ success: false, error: '当前版本不支持用户信息获取' });
      }
    });
  }

  /**
   * 获取用户信息（旧版本兼容）
   */
  getUserProfile() {
    return this.getUserProfileStandard();
  }

  /**
   * 创建默认用户信息
   */
  createDefaultUserInfo() {
    return {
      nickName: '弓长',
      avatarUrl: '/assets/avatar-placeholder.png',
      gender: 0,
      country: '',
      province: '',
      city: '',
      language: 'zh_CN',
      isDefault: true
    };
  }

  /**
   * 保存用户信息到本地存储
   */
  saveUserInfo(userInfo) {
    try {
      this.userInfo = userInfo;
      wx.setStorageSync(USER_INFO_STORAGE_KEY, userInfo);
      wx.setStorageSync(AUTH_STORAGE_KEY, {
        isLoggedIn: true,
        loginTime: Date.now()
      });
      console.log('用户信息已保存');
    } catch (error) {
      console.error('保存用户信息失败:', error);
    }
  }

  /**
   * 从本地存储加载用户信息
   */
  loadUserInfo() {
    try {
      const userInfo = wx.getStorageSync(USER_INFO_STORAGE_KEY);
      const authInfo = wx.getStorageSync(AUTH_STORAGE_KEY);
      
      if (userInfo && authInfo && authInfo.isLoggedIn) {
        this.userInfo = userInfo;
        this.isLoggedIn = true;
        console.log('用户信息已从本地加载:', userInfo);
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
    }
  }

  /**
   * 获取当前用户信息
   */
  getUserInfo() {
    return this.userInfo;
  }

  /**
   * 检查是否已登录
   */
  checkLoginStatus() {
    return this.isLoggedIn && this.userInfo;
  }

  /**
   * 退出登录
   */
  logout() {
    try {
      this.userInfo = null;
      this.isLoggedIn = false;
      wx.removeStorageSync(USER_INFO_STORAGE_KEY);
      wx.removeStorageSync(AUTH_STORAGE_KEY);
      console.log('用户已退出登录');
    } catch (error) {
      console.error('退出登录失败:', error);
    }
  }

  /**
   * 获取用户昵称（用于替换硬编码）
   */
  getNickname() {
    return this.userInfo ? this.userInfo.nickName : '弓长';
  }

  /**
   * 获取用户头像
   */
  getAvatarUrl() {
    return this.userInfo ? this.userInfo.avatarUrl : '/assets/avatar-placeholder.png';
  }

  /**
   * 手动更新用户信息（用于编辑资料）
   */
  async updateUserInfo() {
    const result = await this.getUserProfile();
    if (result.success) {
      this.saveUserInfo(result.userInfo);
      return { success: true, userInfo: result.userInfo };
    }
    return { success: false, error: result.error };
  }

  /**
   * 直接保存用户信息（公开方法）
   */
  saveUserInfoPublic(userInfo) {
    this.saveUserInfo(userInfo);
  }
}

// 导出单例实例
const authManager = new AuthManager();

module.exports = {
  authManager,
  AUTH_STORAGE_KEY,
  USER_INFO_STORAGE_KEY
};
