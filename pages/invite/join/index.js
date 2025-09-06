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
      // 先测试云函数是否正常工作
      console.log('[JOIN] 测试云函数连接...');
      try {
        const testRes = await wx.cloud.callFunction({
          name: 'session',
          data: { action: 'test' }
        });
        console.log('[JOIN] 云函数测试结果:', testRes.result);
      } catch (testError) {
        console.error('[JOIN] 云函数测试失败:', testError);
      }

      // 再尝试调试：列出数据库中的session
      console.log('[JOIN] 尝试调试查询数据库中的sessions...');
      try {
        const debugRes = await wx.cloud.callFunction({
          name: 'session',
          data: { action: 'debug_list' }
        });
        console.log('[JOIN] 数据库中的sessions:', debugRes.result);
        if (!debugRes.result.ok) {
          console.error('[JOIN] 数据库查询失败，详细错误:', JSON.stringify(debugRes.result.error, null, 2));
        }
      } catch (debugError) {
        console.log('[JOIN] 调试查询失败:', debugError);
      }

      // 先检查会话状态
      const getRes = await wx.cloud.callFunction({
        name: 'sessions',
        data: { action: 'get', sid }
      });

      console.log('[JOIN] get session result:', getRes);

      if (getRes.result.ok) {
        const session = getRes.result.session;
        // 验证token
        if (String(session.token) !== String(token)) {
          this.handleValidateError('TOKEN_MISMATCH', '邀请码不正确');
          return;
        }
        if (session.status !== 'open') {
          this.handleValidateError('ENDED', '牌局已结束');
          return;
        }
        
        // 验证成功，调用 join 加入牌局
        const joinRes = await wx.cloud.callFunction({
          name: 'sessions',
          data: { action: 'join', sid, token }
        });
        
        if (joinRes.result.ok) {
          console.log('[JOIN] 验证成功，自动加入牌局');
          this.autoJoinSession();
        } else {
          const error = joinRes.result.error || {};
          console.log('[JOIN] join failed, error code:', error.code, 'msg:', error.msg);
          this.handleValidateError(error.code, error.msg);
        }
      } else {
        const error = getRes.result.error || {};
        console.log('[JOIN] get session failed, error code:', error.code, 'msg:', error.msg);
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
    let msg;
    switch (code) {
      case 'NOT_FOUND':
      case 'SESSION_CLOSED':
        msg = '牌局不存在或已结束';
        break;
      case 'TOKEN_MISMATCH':
        msg = '邀请码不正确，请重新获取';
        break;
      case 'INVITE_TOKEN_EXPIRED':
        msg = '邀请码已过期，请房主重新分享';
        break;
      case 'ENDED':
        msg = '牌局已结束，无法加入';
        break;
      default:
        msg = '无法加入牌局，请稍后再试';
    }
    
    this.setData({ error: msg, loading: false });
  },

  /**
   * 自动加入牌局（验证成功后直接调用）
   */
  async autoJoinSession() {
    const { sid, token } = this.data;
    
    wx.showLoading({ title: '正在加入牌局...' });
    
    try {
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
      // 直接跳转到记分页面，无需停留在确认页
      wx.redirectTo({ 
        url: '/pages/scoring/scoring?sessionId=' + encodeURIComponent(sid) 
      });
      
    } catch (error) {
      wx.hideLoading();
      console.error('[JOIN] 自动加入牌局失败:', error);
      // 如果自动加入失败，回退到手动模式
      this.setData({ 
        canJoin: true, 
        loading: false,
        error: '自动加入失败，请手动点击加入'
      });
    }
  },

  /**
   * 加入牌局（保留原方法作为备用）
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