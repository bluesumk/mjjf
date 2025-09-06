// app.js
// 全局应用实例
const config = require('./config.js');
const RequestManager = require('./utils/request.js');
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
    cloudAvailable: false,
    /** 新增登录态相关字段 */
    openid: null,
    user: null,
    loggedIn: false,
    launchQuery: {}
  },
  async onLaunch() {
    console.log('小程序启动...');
    
    // 1. 初始化云开发环境
    await this.initCloudEnvironment();
    
    // 2. 启动时尝试从本地存储读取已有的对局记录
    this.loadLocalSessions();

    // 3. 水合登录态数据
    this.hydrateAuthState();

    // 4. 获取启动参数
    const opts = wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync() : {};
    this.globalData.launchQuery = (opts && opts.query) || {};

    // 5. 云函数登录获取openid
    await this.performCloudLogin();
  },

  /**
   * 初始化云开发环境
   */
  async initCloudEnvironment() {
    if (!wx.cloud) {
      console.error('请使用基础库 2.2.3+ 以使用云能力');
      return false;
    }

    try {
      const { env } = config.cloud || {};
      await wx.cloud.init({
        // 若配置 env 则使用；否则回退 DYNAMIC_CURRENT_ENV
        env: env === 'DYNAMIC_CURRENT_ENV' ? wx.cloud.DYNAMIC_CURRENT_ENV : env,
        traceUser: config.cloud.traceUser
      });
      console.log('云开发环境初始化成功');
      this.globalData.cloudAvailable = true;
      return true;
    } catch (e) {
      console.error('云开发环境初始化失败:', e);
      this.globalData.cloudAvailable = false;
      return false;
    }
  },

  /**
   * 加载本地存储的会话数据
   */
  loadLocalSessions() {
    try {
      const sessions = wx.getStorageSync(config.storageKeys.sessions);
      if (sessions) {
        this.globalData.sessions = sessions;
      }
    } catch (e) {
      console.warn('读取本地会话失败', e);
      wx.reportAnalytics('storage_fail', {
        action: 'getStorageSync',
        key: 'sessions',
        error: e.message || 'unknown'
      });
    }
  },

  /**
   * 水合登录态数据
   */
  hydrateAuthState() {
    try {
      const userInfo = wx.getStorageSync('userInfo') || null;
      const openid = wx.getStorageSync(config.storageKeys.openid) || null;
      
      // 写入 globalData.userInfo
      this.globalData.userInfo = userInfo;
      this.globalData.user = userInfo; // 保持兼容性
      this.globalData.openid = openid;
      this.globalData.loggedIn = !!openid;
      
      console.log('[APP] 水合用户信息:', userInfo);
    } catch (e) {
      console.warn('水合登录态失败', e);
      wx.reportAnalytics('storage_fail', {
        action: 'getStorageSync',
        key: 'auth_state',
        error: e.message || 'unknown'
      });
    }
  },

  /**
   * 执行云函数登录
   */
  async performCloudLogin() {
    if (!this.globalData.cloudAvailable) {
      console.warn('云开发不可用，跳过云登录');
      return;
    }

    try {
      const res = await wx.cloud.callFunction({ 
        name: config.cloudFunctions.login 
      });
      
      if (res && res.result && res.result.openid) {
        this._commitAuth(res.result.openid);
        console.log('云函数登录成功:', res.result.openid);
      }
    } catch (error) {
      console.warn('[auth] 云函数登录失败', error);
    }
  },


  /**
   * 保存会话数据到本地存储
   */
  saveSessions() {
    try {
      wx.setStorageSync(config.storageKeys.sessions, this.globalData.sessions);
    } catch (e) {
      console.error('保存本地会话失败', e);
      wx.reportAnalytics('storage_fail', {
        action: 'setStorageSync',
        key: 'sessions',
        error: e.message || 'unknown'
      });
      // 关键操作失败时提示用户
      wx.showToast({ 
        title: '保存失败，请重试', 
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 确保登录方法
   */
  ensureLogin() {
    if (this.globalData.loggedIn && this.globalData.openid) {
      return Promise.resolve(this.globalData);
    }
    
    return wx.cloud.callFunction({ 
      name: config.cloudFunctions.login 
    }).then(res => {
      const openid = (res && res.result && res.result.openid) || null;
      if (!openid) return Promise.reject(new Error('NO_OPENID'));
      this._commitAuth(openid);
      return this.globalData;
    });
  },

  /**
   * 提交认证信息
   */
  _commitAuth(openid, user) {
    if (openid) { 
      this.globalData.openid = openid; 
      this.globalData.loggedIn = true; 
      try { wx.setStorageSync(config.storageKeys.openid, openid); } catch (e) { 
        console.error('[AUTH] 保存openid失败:', e); 
        wx.reportAnalytics('storage_fail', { action: 'setStorageSync', key: 'openid', error: e.message || 'unknown' });
      } 
    }
    if (user) { 
      this.globalData.user = user; 
      try { wx.setStorageSync(config.storageKeys.user, user); } catch (e) { 
        console.error('[AUTH] 保存用户信息失败:', e); 
        wx.reportAnalytics('storage_fail', { action: 'setStorageSync', key: 'user', error: e.message || 'unknown' });
      } 
    }
  },

  /**
   * 设置用户信息
   */
  setUser(nextUser) {
    this.globalData.user = nextUser;
    try { wx.setStorageSync(config.storageKeys.user, nextUser); } catch (e) { 
      console.error('[AUTH] 更新用户信息失败:', e); 
      wx.reportAnalytics('storage_fail', { action: 'setStorageSync', key: 'user_update', error: e.message || 'unknown' });
    }
  },

  /**
   * 获取用户信息并保存到云数据库（优化版）
   */
  async getUserProfileAndSave() {
    try {
      // 确保已登录获取openid
      await this.ensureLogin();
      
      // 获取用户授权信息
      const profileRes = await RequestManager.getUserProfile('用于显示头像与昵称');
      const userInfo = profileRes.userInfo;
      
      // 调用云函数保存用户信息
      await RequestManager.callCloudFunction(
        config.cloudFunctions.updateUser,
        { userInfo },
        { loadingTitle: '同步用户信息中...' }
      );

      // 更新本地用户信息
      const updatedUser = Object.assign({}, this.globalData.user || {}, userInfo, { synced: true });
      this.setUser(updatedUser);
      
      return updatedUser;
    } catch (error) {
      console.error('[App] 获取用户信息失败:', error);
      throw error;
    }
  }
});