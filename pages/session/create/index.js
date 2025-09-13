// pages/session/create/index.js
// 创建牌局页面
const app = getApp();
const config = require('../../../config.js');
const sceneUtils = require('../../../utils/scene.js');
const qrcodeUtils = require('../../../utils/qrcode.js');
const inviteCodeUtils = require('../../../tools/invite-code.js');

Page({
  data: {
    participants: [],
    taiSwitch: true, // 默认开启台板
    showAddModal: false,
    newName: '',
    // 邀请相关数据
    sessionId: null,
    inviteToken: null,
    inviteCode: null,
    qrCodeUrl: null,
    qrGenerating: false,
    qrError: null,
    // 分享相关数据
    sid: null,
    token: null,
    shareReady: false
  },

  onLoad() {
    // 获取当前用户昵称
    const authManager = app.globalData.authManager;
    const currentUser = authManager.getNickname();
    
    // 用户本人默认入局
    this.setData({
      participants: [{ name: currentUser }]
    });

    // 生成邀请信息
    this.generateInviteInfo();
    
    // 配置分享菜单
    this.updateShareMenu();
  },

  /**
   * 配置分享菜单
   */
  updateShareMenu() {
    wx.showShareMenu({ 
      withShareTicket: true, 
      menus: config.share.menus
    });
    wx.updateShareMenu({
      withShareTicket: true,
      success: () => {
        console.log('[CREATE] 分享菜单配置成功');
      },
      fail: (error) => {
        console.error('[CREATE] 分享菜单配置失败:', error);
      }
    });
  },

  /**
   * 生成邀请信息
   */
  async generateInviteInfo() {
    try {
      const sessionId = qrcodeUtils.generateSessionId();
      const inviteToken = qrcodeUtils.generateInviteToken();
      const inviteCode = inviteCodeUtils.generateInviteCode(sessionId, inviteToken);

      if (!inviteCode) {
        throw new Error('生成邀请码失败');
      }

      this.setData({
        sessionId,
        inviteToken,
        inviteCode,
        qrGenerating: true,
        qrError: null,
        // 设置分享参数
        sid: sessionId,
        token: inviteToken,
        shareReady: !!(sessionId && inviteToken)
      });

      console.log('[CREATE] 生成邀请信息:', { sessionId, inviteToken, inviteCode });

      // 如果需要更新 wx.showShareMenu（iOS 真机有时需再次调用）
      if (this.data.shareReady && wx.showShareMenu) {
        wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] });
      }

      // 立刻写入云端数据库
      try {
        const participants = (this.data.participants || [])
          .map(p => (typeof p === 'string' ? p : (p && p.name) || ''))
          .map(s => String(s).trim())
          .filter(Boolean);
        const uniq = Array.from(new Set(participants));
        
        await wx.cloud.callFunction({
          name:'session',
          data:{ 
            action:'create', 
            sid:sessionId, 
            token:inviteToken, 
            meta:{ 
              tableMode:this.data.tableMode, 
              participants: uniq 
            } 
          }
        });
        console.log('[SESSION] create ok', sessionId, inviteToken);
      } catch (dbError) {
        console.error('[CREATE] 写入云端失败:', dbError);
      }

      // 尝试生成二维码
      await this.generateQRCode();

    } catch (error) {
      console.error('[CREATE] 生成邀请信息失败:', error);
      this.setData({
        qrError: '生成邀请信息失败',
        qrGenerating: false
      });
    }
  },

  /**
   * 生成二维码
   */
  async generateQRCode() {
    try {
      this.setData({ qrGenerating: true, qrError: null });

      console.log('[CREATE] 开始生成小程序码');
      console.log('[CREATE] SessionId:', this.data.sessionId);
      console.log('[CREATE] InviteToken:', this.data.inviteToken);

      // 尝试云函数生成小程序码
      const cloudResult = await this.tryCloudQRCode();
      if (cloudResult.success) {
        console.log('[CREATE] 小程序码生成成功！');
        this.setData({
          qrCodeUrl: cloudResult.url,
          qrGenerating: false,
          shareImageUrl: cloudResult.url,
          shareReady: true
        });
        return;
      }

      // 失败降级：显示文本邀请码
      throw new Error(cloudResult.error || '小程序码生成失败');

    } catch (error) {
      console.error('[CREATE] 小程序码生成失败，降级到文本邀请码', error);
      this.setData({
        qrError: '小程序码生成失败，请使用下方邀请码分享',
        qrGenerating: false,
        qrCodeUrl: null
      });
      
      wx.showToast({
        title: '请使用邀请码分享',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 尝试云函数生成二维码
   */
  async tryCloudQRCode() {
    try {
      if (!wx.cloud) {
        return { success: false, error: '云开发不可用' };
      }

      // 简单短码（base36）
      const short = (s = '') => {
        try { return Math.abs([...s].reduce((h,c)=> (h*131 + c.charCodeAt(0))|0, 0)).toString(36).slice(0,8); }
        catch { return (Date.now()%1e7).toString(36); }
      };

      // 统一使用工具函数的 scene 生成
      const buildScene = (sid, token) => inviteCodeUtils.buildScene(sid, token);

      const getEnvVersion = () => {
        try {
          return (wx.getAccountInfoSync && wx.getAccountInfoSync().miniProgram.envVersion) || 'release';
        } catch { return 'release'; }
      };
      const envVer = getEnvVersion();
      const requestedEnvVersion = (envVer === 'release') ? 'release' : 'trial';

      const scene = buildScene(this.data.sessionId, this.data.inviteToken);

      console.log('[CREATE] wxacode request', { scene, requestedEnvVersion });

      const res = await wx.cloud.callFunction({
        name: 'wxacode',
        data: {
          page: 'pages/invite/join/index',
          scene,
          requestedEnvVersion,
          checkPath: false,
          sid: this.data.sessionId,
          token: this.data.inviteToken,
          // 可切换：storage: false 时直接返回 base64
          storage: true
        }
      }).then(res => {
        console.log('[SHARE] requestedEnvVersion =', requestedEnvVersion,
                    'path =', `/pages/invite/join/index?sid=${this.data.sessionId}&token=${this.data.inviteToken}`);
        return res;
      }).catch(err => {
        console.error('[CREATE] wxacode rpc error', err);
        throw new Error('RPC_FAIL');
      });

      console.log('[CREATE] wxacode result', res);

      const r = res && res.result;
      if (!r) throw new Error('EMPTY_RESULT');

      if (r.ok) {
        if (r.url) {
          // 用临时URL展示，同时保存用于分享
          this.setData({ shareImageUrl: r.url, shareReady: true });
          return { success: true, url: r.url, via: r.via };
        } else if (r.base64) {
          // 或者直接展示 base64
          this.setData({ shareReady: true });
          return { success: true, base64: r.base64, via: r.via };
        } else {
          throw new Error('NO_IMAGE_PAYLOAD');
        }
      } else {
        const detail = r.error ? `[${r.error.code}] ${r.error.msg}` : 'UNKNOWN';
        throw new Error(detail);
      }

    } catch (error) {
      console.error('[CREATE] 云函数二维码生成失败:', error);
      return { success: false, error: error.errMsg || error.message || '云函数调用失败' };
    }
  },

  // QA-FIX: A3 删除重复的 onShareAppMessage 定义，保留下方统一实现

  /**
   * 分享邀请 - 已移除直接调用，使用标准分享机制
   */
  shareInvite() {
    // 不再直接调用 wx.shareAppMessage，改用 open-type="share" 按钮
    if (!this.data.shareReady) {
      wx.showToast({ title: '请先创建牌局', icon: 'none' });
      return;
    }
    // 此方法现在仅用于检查状态，实际分享由微信标准机制处理
    console.log('[CREATE] 分享按钮状态检查通过');
  },

  /**
   * 复制邀请码
   */
  copyInviteCode() {
    if (!this.data.inviteCode) {
      wx.showToast({ title: '邀请码未生成', icon: 'none' });
      return;
    }

    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        wx.showToast({ title: '邀请码已复制', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '复制失败', icon: 'none' });
      }
    });
  },

  /**
   * 刷新二维码
   */
  refreshQRCode() {
    this.generateQRCode();
  },

  // 以下是参与者管理相关方法
  onTaiSwitchChange(e) {
    this.setData({ taiSwitch: e.detail.value });
  },

  showAddModal() {
    this.setData({ showAddModal: true, newName: '' });
  },

  inputChange(e) {
    this.setData({ newName: e.detail.value });
  },

  cancelAdd() {
    this.setData({ showAddModal: false, newName: '' });
  },

  confirmAdd() {
    const name = (this.data.newName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    // 检查重复
    if (this.data.participants.some(p => p.name === name)) {
      wx.showToast({ title: '该参与者已存在', icon: 'none' });
      return;
    }
    this.setData({
      participants: [...this.data.participants, { name }],
      showAddModal: false,
      newName: ''
    });
  },

  /**
   * 创建对局并跳转记分页面
   */
  startScoring() {
    // 生成邀请信息后直接进入计分前...
    const normalized = (this.data.participants || [])
      .map(p => (typeof p === 'string' ? p : (p && p.name) || ''))
      .map(s => String(s).trim())
      .filter(Boolean);
    const uniq = Array.from(new Set(normalized));
    if (!uniq.length) {
      wx.showToast({ title: '请添加参与者', icon: 'none' }); 
      return;
    }
    try { wx.setStorageSync('last_invite_participants', uniq); } catch(e) {}

    // 使用已生成的sessionId
    const sessionId = this.data.sessionId;
    
    const session = {
      id: sessionId,
      participants: uniq,
      taiSwitch: this.data.taiSwitch,
      rounds: [],
      multiplier: 1,
      createdAt: new Date().toISOString(),
      status: 'ongoing',
      finalScores: null,
      inviteToken: this.data.inviteToken // 保存邀请令牌
    };
    
    app.globalData.sessions.push(session);
    app.globalData.currentSessionId = session.id;
    app.saveSessions();
    
    wx.navigateTo({ url: '/pages/scoring/scoring' });
  },

  /**
   * 分享邀请功能（优化版）
   */
  onShareAppMessage() {
    const { sessionId: sid, inviteToken: token, shareImageUrl } = this.data || {};
    
    if (!sid || !token) {
      return {
        title: config.share.defaultTitle,
        path: config.pages.index,
        imageUrl: config.share.defaultImageUrl
      };
    }

    const path = `/pages/invite/join/index?sid=${encodeURIComponent(sid)}&token=${encodeURIComponent(token)}`;
    console.log('[SHARE] 分享路径:', path);
    
    return {
      title: `邀请你加入麻将计分，房间号：${(token||'').toUpperCase()}`,
      path,
      imageUrl: shareImageUrl || config.share.defaultImageUrl
    };
  },

  /**
   * 页面显示时开启分享
   */
  onShow() {
    wx.showShareMenu({ 
      withShareTicket: true, 
      menus: config.share.menus 
    });
  },

  /**
   * 复制邀请码到剪贴板
   */
  async copyInviteCode() {
    const { inviteToken } = this.data;
    if (!inviteToken) {
      wx.showToast({ icon: 'none', title: '邀请码未生成' });
      return;
    }

    try {
      await wx.setClipboardData({ 
        data: inviteToken.toUpperCase() 
      });
      wx.showToast({ 
        title: '邀请码已复制', 
        icon: 'success',
        duration: 1500 
      });
    } catch (error) {
      console.error('复制失败:', error);
      wx.showToast({ 
        icon: 'none', 
        title: '复制失败' 
      });
    }
  }
});

