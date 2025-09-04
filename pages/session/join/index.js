// pages/session/join/index.js
// 加入牌局页面
const app = getApp();
const sceneUtils = require('../../../utils/scene.js');

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
    console.log('[JOIN:onLoad]', { raw: options });
    
    // 解析顺序：先 query → 再 scene（兼容分享与扫码）
    let { sid, token } = options || {};
    
    // 兼容历史字段名映射
    sid = sid || options.sessionId;
    token = token || options.inviteToken;
    
    console.log('[JOIN:query]', { sid, token });
    
    if (!sid || !token) {
      const scene = options?.scene ? decodeURIComponent(options.scene) : '';
      const map = this.parseScene(scene); // 使用本地解析方法
      sid = sid || map.sid; 
      token = token || map.token;
      console.log('[JOIN:scene]', { scene, sid, token });
    }
    
    console.log('[JOIN:final]', { sid, token });
    
    if (!sid || !token) {
      wx.showToast({ title: '邀请链接无效，缺少参数', icon: 'none' });
      this.setData({
        error: '邀请链接无效，缺少必要参数',
        loading: false
      });
      return;
    }

    this.setData({ sessionId: sid, token: token });
    this.loadSession(sid, token);
  },

  /**
   * 解析场景参数 - 本地方法
   */
  parseScene(scene) {
    if (!scene || typeof scene !== 'string') {
      return { sid: null, token: null };
    }
    
    try {
      // 首先尝试使用 sceneUtils 解析
      const sceneData = sceneUtils.parseScene(scene);
      if (sceneData && sceneData.s && sceneData.t) {
        // 根据短码查找原始ID
        const originalIds = sceneUtils.findOriginalIds(sceneData.s, sceneData.t);
        if (originalIds) {
          return {
            sid: originalIds.sessionId,
            token: originalIds.inviteToken
          };
        }
      }
      
      // 兼容直接的 sid=xxx&token=yyy 格式
      const params = {};
      const pairs = scene.split('&');
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[key] = decodeURIComponent(value);
        }
      }
      
      return {
        sid: params.sid || params.sessionId || null,
        token: params.token || params.inviteToken || null
      };
      
    } catch (error) {
      console.error('[JOIN:parseScene] 解析错误:', error);
      return { sid: null, token: null };
    }
  },

  /**
   * 根据 sid 查询会话
   */
  loadSession(sessionId, token) {
    try {
      const sessions = app.globalData.sessions || [];
      const session = sessions.find(s => s.id == sessionId);
      
      const hasSession = !!session;
      const status = session ? session.status : null;
      
      console.log('[JOIN]', { sid: sessionId, token, hasSession, status });
      
      if (!session) {
        this.setData({
          error: '该牌局不存在或已被删除',
          loading: false
        });
        return;
      }
      
      // 验证邀请令牌
      if (session.inviteToken && session.inviteToken !== token) {
        this.setData({
          error: '邀请链接无效，令牌不匹配',
          loading: false
        });
        return;
      }
      
      // 检查会话状态
      if (status === 'finished') {
        this.setData({
          error: '该牌局已结束，无法加入',
          loading: false
        });
        return;
      }
      
      // 若存在且 status !== 'finished'，将 status 置为 'ongoing' 并允许加入
      if (status !== 'ongoing') {
        session.status = 'ongoing';
        app.saveSessions(); // 保存状态变更
        console.log('[JOIN] 会话状态已更新为ongoing');
      }
      
      this.setData({
        session,
        loading: false,
        error: null
      });
      
    } catch (error) {
      console.error('[JOIN] 加载会话出错:', error);
      this.setData({
        error: '加载牌局信息失败，请重试',
        loading: false
      });
    }
  },

  /**
   * 加入牌局
   */
  async joinSession() {
    if (this.data.joining) return;
    
    this.setData({ joining: true });
    
    try {
      const { sessionId } = this.data;
      
      // 设置当前会话ID
      app.globalData.currentSessionId = sessionId;
      
      // 跳转到计分页面
      wx.redirectTo({
        url: '/pages/scoring/scoring',
        success: () => {
          console.log('[JOIN] 成功加入牌局:', sessionId);
          wx.showToast({
            title: '成功加入牌局',
            icon: 'success'
          });
        },
        fail: (error) => {
          console.error('[JOIN] 跳转失败:', error);
          wx.showToast({
            title: '跳转失败，请重试',
            icon: 'none'
          });
        }
      });
      
    } catch (error) {
      console.error('[JOIN] 加入牌局失败:', error);
      wx.showToast({
        title: '加入失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ joining: false });
    }
  },

  /**
   * 返回首页
   */
  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  },

  /**
   * 刷新页面
   */
  refresh() {
    if (this.data.sessionId && this.data.token) {
      this.setData({ loading: true, error: null });
      this.loadSession(this.data.sessionId, this.data.token);
    }
  }
});
