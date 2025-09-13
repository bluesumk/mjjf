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
          // 若只拿到6位短码，先云端映射成完整 sid/token
          const s = sceneResult.s, t = sceneResult.t;
          if ((!sid || !token) && s && t) {
            try {
              const mapRes = await wx.cloud.callFunction({ name: 'session', data: { action: 'lookupShort', s, t } });
              if (mapRes && mapRes.result && mapRes.result.ok) {
                sid = mapRes.result.sid;
                token = mapRes.result.token;
              }
            } catch (e) { console.warn('[JOIN] lookupShort fail:', e); }
          }
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
      // 移除调试性云函数调用，降低首屏耗时

      // 先检查会话状态
      const getRes = await wx.cloud.callFunction({
        name: 'session',
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
          name: 'session',
          data: { action: 'join', sid, token }
        });
        
        if (joinRes.result.ok) {
          console.log('[JOIN] 验证成功，自动加入牌局');
          // 从云端元数据提取参与者与台板开关
          const meta = session.meta || {};
          let participants = Array.isArray(meta.participants) ? meta.participants.filter(Boolean) : [];
          
          // 兜底水合：如果参与者为空或只有1人，尝试从本地缓存回填
          if (participants.length <= 1) {
            try {
              const fallback = wx.getStorageSync && wx.getStorageSync('last_invite_participants');
              if (Array.isArray(fallback) && fallback.length > 1) {
                console.log('[JOIN] 使用本地缓存参与者:', fallback);
                participants = fallback;
              }
            } catch (e) {
              console.warn('[JOIN] 读取本地缓存失败:', e);
            }
          }
          
          const taiSwitch = !!meta.taiSwitch;
          
          // 获取云端members列表，用于同步已加入的用户
          const members = Array.isArray(session.members) ? session.members : [];
          console.log('[JOIN] 云端members:', members);
          console.log('[JOIN] 最终参与者:', participants);
          
          this.autoJoinSession({ participants, taiSwitch, members });
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
  async autoJoinSession(payload = {}) {
    const { sid, token } = this.data;
    const { participants = [], taiSwitch = true, members = [] } = payload || {};
    
    wx.showLoading({ title: '正在加入牌局...', mask: true });
    
    try {
      const app = getApp();
      
      // 同步云端members到本地participants
      // 这里需要将openid转换为用户昵称，暂时使用云端meta中的participants
      // 后续可以通过members列表查询用户信息来完善
      let finalParticipants = participants.slice();
      
      // 如果云端有members信息，可以在这里进行更复杂的同步逻辑
      // 目前先使用meta中的participants，确保与发起者看到的一致
      console.log('[JOIN] 同步参与者:', { 
        original: participants, 
        members: members, 
        final: finalParticipants 
      });
      
      // 将会话注入本地（与 invite/create 结构对齐）
      const list = app.globalData.sessions || [];
      const idx = list.findIndex(s => String(s.id) === String(sid));
      if (idx === -1) {
        const session = {
          id: sid,
          participants: finalParticipants, 
          taiSwitch: !!taiSwitch, 
          rounds: [],
          multiplier: 1, 
          createdAt: new Date().toISOString(),
          status: 'ongoing', 
          finalScores: null, 
          inviteToken: token
        };
        list.push(session);
      } else {
        // 覆盖更新本地已有临时会话，确保参与者与台版配置可见
        const s = list[idx];
        s.participants = (finalParticipants && finalParticipants.length > 0) ? finalParticipants.slice() : (s.participants || []);
        s.taiSwitch = typeof taiSwitch === 'boolean' ? taiSwitch : !!s.taiSwitch;
        s.inviteToken = token || s.inviteToken;
      }
      app.globalData.sessions = list;
      app.saveSessions();
      
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
    
    wx.showLoading({ title: '正在加入...', mask: true });
    
    try {
      // 重新获取会话，带回 meta
      const getRes = await wx.cloud.callFunction({
        name: 'session',
        data: { action: 'get', sid }
      });
      const doc = getRes && getRes.result && getRes.result.session;
      if (!doc || String(doc.token) !== String(token) || doc.status !== 'open') {
        throw new Error('VALIDATE_FAIL');
      }
      const meta = doc.meta || {};
      const participants = Array.isArray(meta.participants) ? meta.participants.filter(Boolean) : [];
      const taiSwitch = !!meta.taiSwitch;
      
      const app = getApp();
      
      // 写入或更新本地会话
      const list = app.globalData.sessions || [];
      const idx = list.findIndex(s => String(s.id) === String(sid));
      if (idx === -1) {
        list.push({
          id: sid,
          participants: participants.slice(),
          taiSwitch: !!taiSwitch,
          rounds: [],
          multiplier: 1,
          createdAt: new Date().toISOString(),
          status: 'ongoing',
          finalScores: null,
          inviteToken: token
        });
      } else {
        list[idx].participants = (participants && participants.length > 0) ? participants.slice() : (list[idx].participants || []);
        list[idx].taiSwitch = typeof taiSwitch === 'boolean' ? taiSwitch : !!list[idx].taiSwitch;
        list[idx].inviteToken = token || list[idx].inviteToken;
      }
      app.globalData.sessions = list;
      app.saveSessions();
      
      app.globalData.currentSessionId = sid;
      
      wx.hideLoading();
      wx.redirectTo({ 
        url: '/pages/scoring/scoring?sessionId=' + encodeURIComponent(sid) 
      });
      
    } catch (error) {
      wx.hideLoading();
      console.error('[JOIN] 加入牌局失败:', error);
      this.setData({ error: '加入失败，请稍后重试', loading: false, canJoin: true });
      setTimeout(() => this.setData({ error: '' }), 1500);
    }
  },


  /**
   * 返回首页
   */
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});