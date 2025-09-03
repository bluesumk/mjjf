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
    
    wx.showLoading({ title: '正在加入牌局...' });
    
    try {
      // 确保已登录
      const app = getApp();
      await app.ensureLogin();
      
      // 调用加入云函数
      const res = await wx.cloud.callFunction({
        name: 'session',
        data: { action: 'join', sid, token }
      });
      
      wx.hideLoading();
      
      if (res.result.ok) {
        wx.showToast({ 
          title: res.result.message || '加入成功', 
          icon: 'success' 
        });
        
        // 更新本地会话列表和全局状态
        this.updateLocalSessions(sid, token);
        
        // 跳转到计分页面
        setTimeout(() => {
          wx.redirectTo({
            url: `${config.pages.scoring}?sessionId=${sid}`
          });
        }, 1500);
        
      } else {
        const error = res.result.error || {};
        this.showJoinError(error.code, error.msg);
      }
      
    } catch (error) {
      wx.hideLoading();
      console.error('[JOIN] 加入牌局失败:', error);
      wx.showToast({ 
        title: '网络异常，请稍后重试', 
        icon: 'none' 
      });
    }
  },

  /**
   * 显示加入错误信息
   */
  showJoinError(code, defaultMsg) {
    let errorMsg = defaultMsg || '加入失败';
    
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
      case 'FULL':
        errorMsg = '牌局人数已满';
        break;
      case 'FORBIDDEN':
        errorMsg = '仅房主可结束';
        break;
      default:
        errorMsg = defaultMsg || '加入失败，请重试';
    }
    
    this.setData({ error: errorMsg });
    wx.showToast({ title: errorMsg, icon: 'none', duration: 2000 });
  },

  /**
   * 更新本地会话列表和全局状态
   */
  updateLocalSessions(sessionId, token) {
    try {
      const app = getApp();
      
      // 设置当前会话ID
      app.globalData.currentSessionId = sessionId;
      
      // 查找或创建会话记录
      const sessions = app.globalData.sessions || [];
      let existingSession = sessions.find(s => s.id === sessionId);
      
      if (!existingSession) {
        // 创建新的会话记录
        const newSession = {
          id: sessionId,
          inviteToken: token,
          status: 'ongoing',
          createdAt: new Date().toISOString(),
          participants: [], // 将在计分页面填充
          rounds: [],
          finalScores: null
        };
        
        app.globalData.sessions.push(newSession);
        app.saveSessions();
      }
      
      console.log(`[JOIN] 已加入会话: ${sessionId}, 当前会话列表长度: ${app.globalData.sessions.length}`);
    } catch (error) {
      console.warn('[JOIN] 更新本地会话失败:', error);
    }
  },

  /**
   * 返回首页
   */
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});