// pages/invite/join.js
// 扫码加入牌局页面
const app = getApp();

Page({
  data: {
    sessionId: null,
    token: null,
    session: null,
    loading: true,
    error: null,
    joining: false
  },

  onLoad(options) {
    console.log('扫码加入页面参数:', options);
    
    const { sessionId, token } = options;
    
    if (!sessionId || !token) {
      this.setData({
        error: '邀请链接无效，缺少必要参数',
        loading: false
      });
      return;
    }

    this.setData({ sessionId, token });
    this.loadSessionInfo();
  },

  /**
   * 加载会话信息
   */
  loadSessionInfo() {
    try {
      const sessions = app.globalData.sessions;
      const session = sessions.find(s => s.id.toString() === this.data.sessionId);
      
      if (!session) {
        this.setData({
          error: '牌局不存在或已结束',
          loading: false
        });
        return;
      }

      // 验证邀请令牌
      if (session.inviteToken && session.inviteToken !== this.data.token) {
        this.setData({
          error: '邀请码已过期或无效',
          loading: false
        });
        return;
      }

      // 检查牌局状态
      if (session.status === 'finished') {
        this.setData({
          error: '该牌局已结束，无法加入',
          loading: false
        });
        return;
      }

      this.setData({
        session,
        loading: false
      });

    } catch (error) {
      console.error('加载会话信息失败:', error);
      this.setData({
        error: '加载牌局信息失败',
        loading: false
      });
    }
  },

  /**
   * 加入牌局
   */
  async joinSession() {
    if (this.data.joining) return;

    try {
      this.setData({ joining: true });

      // 获取当前用户信息
      const authManager = app.globalData.authManager;
      const currentUser = authManager.getNickname();

      if (!currentUser) {
        throw new Error('获取用户信息失败');
      }

      // 检查是否已在牌局中
      if (this.data.session.participants.includes(currentUser)) {
        wx.showToast({ title: '您已在该牌局中', icon: 'none' });
        this.navigateToSession();
        return;
      }

      // 加入牌局
      const sessions = app.globalData.sessions;
      const sessionIndex = sessions.findIndex(s => s.id.toString() === this.data.sessionId);
      
      if (sessionIndex === -1) {
        throw new Error('牌局不存在');
      }

      // 更新参与者列表
      sessions[sessionIndex].participants.push(currentUser);
      
      // 保存到本地存储
      app.saveSessions();

      wx.showToast({ 
        title: '加入成功', 
        icon: 'success',
        duration: 1500
      });

      setTimeout(() => {
        this.navigateToSession();
      }, 1500);

    } catch (error) {
      console.error('加入牌局失败:', error);
      wx.showToast({ 
        title: error.message || '加入失败', 
        icon: 'none' 
      });
      this.setData({ joining: false });
    }
  },

  /**
   * 跳转到牌局页面
   */
  navigateToSession() {
    const session = this.data.session;
    
    if (session.status === 'ongoing') {
      // 正在进行的牌局，跳转到计分页面
      app.globalData.currentSessionId = session.id;
      wx.redirectTo({ url: '/pages/scoring/scoring' });
    } else {
      // 未开始的牌局，跳转到邀请页面
      wx.redirectTo({ url: '/pages/invite/invite' });
    }
  },

  /**
   * 返回首页
   */
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  /**
   * 重新加载
   */
  reload() {
    this.setData({ loading: true, error: null });
    this.loadSessionInfo();
  }
});

