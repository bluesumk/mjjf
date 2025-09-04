// 引入场景解析工具和配置
const inviteCodeUtils = require('../../../tools/invite-code.js');
const config = require('../../../config.js');

Page({
  data: {
    sid: '',
    token: '',
    canJoin: false,
    error: '',
    loading: true
  },

  async onLoad(options) {
    // QA-FIX: A7 JOIN 日志补全
    try {
      const enter = (wx.getEnterOptionsSync && wx.getEnterOptionsSync()) || {};
      console.log('[JOIN] getEnterOptionsSync=', enter);
    } catch(e){}
    console.log('[JOIN] onLoad options=', options);

    let { sid, token } = options || {};
    
    // 使用工具函数解析场景值
    if ((!sid || !token) && options.scene) {
      try {
        const sceneResult = inviteCodeUtils.parseScene(decodeURIComponent(options.scene));
        if (sceneResult) {
          sid = sid || sceneResult.s;
          token = token || sceneResult.t;
        }
      } catch (error) {
        console.error('[JOIN] 场景解析失败:', error);
      }
    }

    console.log('[JOIN] 解析参数:', { sid, token, scene: options.scene });
    console.log('[JOIN] 分享卡片跳转路径:', `/pages/invite/join/index?sid=${sid}&token=${token}`);

    if (!sid || !token) {
      this.setData({ 
        error: '参数缺失，请通过分享链接进入',
        loading: false 
      });
      return;
    }

    this.setData({ sid, token });

    // 验证邀请链接
    this.validateInvite(sid, token);
  },

  /**
   * 验证邀请链接
   */
  async validateInvite(sid, token) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'session',
        data: { action: 'validate', sid, token }
      });

      console.log('[JOIN] validate result:', res);

      if (res.result.ok) {
        this.setData({ 
          canJoin: true, 
          loading: false 
        });
      } else {
        const error = res.result.error || {};
        this.handleValidateError(error.code, error.msg);
      }
    } catch (error) {
      console.error('[JOIN] validate error:', error);
      this.setData({ 
        error: '网络异常，请稍后重试',
        loading: false 
      });
    }
  },

  /**
   * 处理验证错误
   */
  handleValidateError(code, defaultMsg) {
    let errorMsg = defaultMsg || '无法加入牌局';
    
    switch (code) {
      case 'NOT_FOUND':
        errorMsg = '牌局不存在或已结束';
        break;
      case 'ENDED':
        errorMsg = '牌局已结束，无法加入';
        break;
      case 'TOKEN_MISMATCH':
        errorMsg = '邀请码不正确';
        break;
      default:
        errorMsg = defaultMsg || '无法加入牌局';
    }
    
    this.setData({ 
      error: errorMsg,
      loading: false 
    });
  },

  /**
   * 加入牌局
   */
  async joinSession() {
    if (!this.data.canJoin) {
      wx.showToast({ title: '无法加入牌局', icon: 'none' });
      return;
    }

    const { sid, token } = this.data;
    
    wx.showLoading({ title: '正在加入...' });
    
    try {
      // 再次校验，确保有效
      const res = await wx.cloud.callFunction({
        name: 'session',
        data: { action: 'validate', sid, token }
      });
      
      const ok = res && res.result && res.result.ok;
      if (!ok) {
        throw new Error('VALIDATE_FAIL');
      }
      
      const app = getApp();
      
      // 将会话注入本地（与 invite/create 结构对齐）
      const exists = (app.globalData.sessions || []).some(s => String(s.id) === String(sid));
      if (!exists) {
        const session = {
          id: sid,
          participants: [], 
          taiSwitch: true, 
          rounds: [],
          multiplier: 1, 
          createdAt: new Date().toISOString(),
          status: 'ongoing', 
          finalScores: null, 
          inviteToken: token
        };
        app.globalData.sessions.push(session);
        app.saveSessions();
      }
      
      app.globalData.currentSessionId = sid;
      
      wx.hideLoading();
      wx.redirectTo({ 
        url: '/pages/scoring/scoring?sessionId=' + encodeURIComponent(sid) 
      });
      
    } catch (error) {
      wx.hideLoading();
      console.error('[JOIN] 加入牌局失败:', error);
      wx.showToast({ 
        title: '加入失败，请重试', 
        icon: 'none' 
      });
    }
  },


  /**
   * 返回首页
   */
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});