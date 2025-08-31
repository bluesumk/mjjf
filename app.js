// app.js
// 全局应用实例
const authUtils = require('./utils/auth.js');
const authManager = authUtils.authManager;

App({
  globalData: {
    /**
     * 所有对局列表，每个对局包含参与者、轮次、状态和最终分数
     * {
     *   id: Number, // 唯一标识
     *   participants: Array<String>, // 参与者姓名
     *   taiSwitch: Boolean, // 是否开启台版
     *   rounds: Array<{scores: Object}>, // 每一局的得分结果
     *   multiplier: Number, // 收盘时的倍率
     *   createdAt: String, // 创建时间 ISO 字符串
     *   status: 'ongoing' | 'finished', // 状态
     *   finalScores: Object | null // 最终分数
     * }
     */
    sessions: [],
    /** 当前进行中的对局 ID */
    currentSessionId: null,
    /** 用户认证管理器 */
    authManager: authManager,
    /** 云开发是否可用 */
    cloudAvailable: false
  },
  async onLaunch() {
    console.log('小程序启动...');
    
    // 1. 初始化云开发环境
    this.initCloudEnvironment();
    
    // 2. 启动时尝试从本地存储读取已有的对局记录
    try {
      const sessions = wx.getStorageSync('sessions');
      if (sessions) {
        this.globalData.sessions = sessions;
      }
    } catch (e) {
      console.warn('读取本地会话失败', e);
    }

    // 3. 执行微信登录流程（仅做基础检查，具体授权在授权页面处理）
    try {
      const loginResult = await authManager.login();
      console.log('登录检查结果:', loginResult);
      
      if (loginResult.success) {
        console.log('用户已登录:', loginResult.userInfo.nickName);
      } else if (loginResult.needAuth) {
        console.log('用户需要授权，将在授权页面处理');
      }
    } catch (error) {
      console.error('登录检查异常:', error);
    }
  },

  /**
   * 初始化云开发环境
   */
  initCloudEnvironment() {
    try {
      if (!wx.cloud) {
        console.warn('当前环境不支持云开发，仅使用文本邀请码');
        return;
      }

      // 初始化云开发
      wx.cloud.init({
        env: 'cloudbase-3go6h0x7b3bc5b04',
        traceUser: true
      });
      
      console.log('[INIT] cloud inited with env=cloudbase-3go6h0x7b3bc5b04');
      
      console.log('云开发环境初始化成功');
      
      // 测试云开发连接
      this.testCloudConnection();
      
    } catch (error) {
      console.error('云开发环境初始化失败:', error);
      console.log('将仅使用文本邀请码分享');
    }
  },

  /**
   * 测试云开发连接
   */
  testCloudConnection() {
    try {
      wx.cloud.callFunction({
        name: 'ping',
        data: { test: 'connection' },
        success: (res) => {
          console.log('云开发连接测试成功:', res);
          this.globalData.cloudAvailable = true;
        },
        fail: (error) => {
          console.log('云开发连接测试失败:', error.errMsg);
          this.globalData.cloudAvailable = false;
          
          if (error.errMsg && error.errMsg.includes('Cloud API isn\'t enabled')) {
            console.log('云开发未正确配置，仅使用文本邀请码');
          } else if (error.errMsg && error.errMsg.includes('cloud function')) {
            console.log('测试云函数不存在，但云开发环境可用');
            this.globalData.cloudAvailable = true;
          }
        }
      });
    } catch (error) {
      console.error('云开发连接测试异常:', error);
      this.globalData.cloudAvailable = false;
    }
  },
  /**
   * 保存会话数据到本地存储
   */
  saveSessions() {
    try {
      wx.setStorageSync('sessions', this.globalData.sessions);
    } catch (e) {
      console.error('保存本地会话失败', e);
    }
  }
});