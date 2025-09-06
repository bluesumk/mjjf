// pages/invite/invite.js
const app = getApp();
const qrcodeUtils = require('../../utils/qrcode.js');
const inviteCodeUtils = require('../../tools/invite-code.js');
const generateInviteToken = qrcodeUtils.generateInviteToken;
const generateSessionId = qrcodeUtils.generateSessionId;

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
    qrError: null
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
  },
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
   * 生成邀请信息
   */
  async generateInviteInfo() {
    try {
      const sessionId = generateSessionId();
      const inviteToken = generateInviteToken();
      const inviteCode = inviteCodeUtils.generateInviteCode(sessionId, inviteToken);
      const scene = inviteCodeUtils.buildScene(sessionId, inviteToken);

      if (!inviteCode || !scene) {
        throw new Error('缺少 sid/token');
      }

      this.setData({
        sessionId,
        inviteToken,
        inviteCode,
        qrGenerating: true,
        qrError: null
      });

      // 调试日志
      console.log('[INVITE] code=' + inviteCode + ' scene=' + scene);
      console.log('生成邀请信息:', { sessionId, inviteToken, inviteCode });

      // 立刻写入云端数据库
      try {
        console.log('[INVITE] 准备写入云端 - sid:', sessionId, 'token:', inviteToken);
        const createRes = await wx.cloud.callFunction({
          name: 'sessions',
          data: { 
            action: 'create', 
            sid: sessionId, 
            token: inviteToken,
            participants: this.data.participants.map(p => p.name),
            taiSwitch: this.data.taiSwitch,
            meta: { tableMode: this.data?.tableMode } 
          }
        });
        console.log('[INVITE] 会话写入云端结果:', createRes);
        if (createRes.result && createRes.result.ok) {
          console.log('[INVITE] 会话已成功写入云端');
          // 创建成功后才设置 shareReady
          this.setData({ shareReady: true });
        } else {
          console.error('[INVITE] 会话写入云端失败:', createRes.result);
          console.error('[INVITE] 详细错误信息:', JSON.stringify(createRes.result.error, null, 2));
        }
      } catch (dbError) {
        console.error('[INVITE] 写入云端失败:', dbError);
      }

      // 尝试生成二维码
      await this.generateQRCode();

    } catch (error) {
      console.error('生成邀请信息失败:', error);
      this.setData({
        qrError: '生成邀请信息失败',
        qrGenerating: false
      });
    }
  },

  /**
   * 生成二维码（仅走小程序码主路径）
   */
  async generateQRCode() {
    try {
      this.setData({ qrGenerating: true, qrError: null });

      console.log('=== 开始小程序码生成 ===');
      console.log('SessionId:', this.data.sessionId);
      console.log('InviteToken:', this.data.inviteToken);

      // 尝试云函数生成小程序码
      const cloudResult = await this.tryCloudQRCode();
      if (cloudResult.success) {
        console.log('小程序码生成成功！');
        // 埋点：小程序码生成成功
        wx.reportAnalytics('wxacode_success', {
          sid: this.data.sessionId,
          fromCache: cloudResult.fromCache ? 1 : 0
        });
        this.setData({
          qrCodeUrl: cloudResult.url,
          qrGenerating: false,
          shareImageUrl: cloudResult.url,
          shareReady: true
        });
        return;
      } else {
        console.log('小程序码生成失败:', cloudResult.error);
        // 埋点：小程序码生成失败
        wx.reportAnalytics('wxacode_fail', {
          code: cloudResult.code || 'UNKNOWN',
          message: cloudResult.error?.substring(0, 100) || '未知错误'
        });
      }

      // 失败降级：显示文本邀请码
      throw new Error(cloudResult.error || '小程序码生成失败');

    } catch (error) {
      console.error('=== 小程序码生成失败，降级到文本邀请码 ===', error);
      // 埋点：降级到文本邀请码
      wx.reportAnalytics('wxacode_fallback', {
        type: 'text_invite_code'
      });
      this.setData({
        qrError: '小程序码生成失败，请使用下方邀请码分享',
        qrGenerating: false,
        qrCodeUrl: null // 确保不显示二维码
      });
      
      // 显示友好提示
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
      // 检查云开发是否可用
      if (!wx.cloud) {
        console.log('云开发API不可用，跳过云函数方式');
        return { success: false, error: '云开发不可用' };
      }

      // 检查云开发环境是否正确初始化
      try {
        // 先测试云开发连接
        await this.testCloudConnection();
      } catch (testError) {
        console.log('云开发连接测试失败，跳过云函数方式:', testError.message);
        return { success: false, error: '云开发环境未正确配置' };
      }

      // 简单短码（base36）
      const short = (s = '') => {
        try { return Math.abs([...s].reduce((h,c)=> (h*131 + c.charCodeAt(0))|0, 0)).toString(36).slice(0,8); }
        catch { return (Date.now()%1e7).toString(36); }
      };

      // 安全 scene：只含 0-9a-zA-Z.-_，长度≤32
      const buildScene = (sid, token) => {
        const s1 = short(sid);
        const s2 = short(token);
        const scene = `${s1}.${s2}`; // 例如 "k3f1a2.b9c8d0"（去掉 & 和 =）
        return scene.slice(0, 32);
      };

      const getEnvVersion = () => {
        try {
          return (wx.getAccountInfoSync && wx.getAccountInfoSync().miniProgram.envVersion) || 'release';
        } catch { return 'release'; }
      };
      const envVer = getEnvVersion();
      const requestedEnvVersion = (envVer === 'release') ? 'release' : 'trial';

      const scene = buildScene(this.data.sessionId, this.data.inviteToken);

      console.log('[wxacode] request', { scene, requestedEnvVersion });

      const res = await wx.cloud.callFunction({
        name: 'wxacode',
        data: {
          page: 'pages/invite/join/index',
          scene,
          requestedEnvVersion,
          checkPath: false,
          sid: short(this.data.sessionId),
          token: short(this.data.inviteToken),
          // 可切换：storage: false 时直接返回 base64
          storage: true
        }
      }).then(res => {
        console.log('[SHARE] requestedEnvVersion =', requestedEnvVersion,
                    'path =', `/pages/invite/join/index?sid=${this.data.sessionId}&token=${this.data.inviteToken}`);
        return res;
      }).catch(err => {
        console.error('[wxacode] rpc error', err);
        throw new Error('RPC_FAIL');
      });

      console.log('[wxacode] result', res);

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
      console.error('云函数二维码生成失败:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 测试云开发连接
   */
  async testCloudConnection() {
    return new Promise((resolve, reject) => {
      // 尝试调用一个简单的云函数或数据库操作来测试连接
      try {
        wx.cloud.callFunction({
          name: 'ping', // 测试用的云函数
          data: {},
          success: () => resolve(),
          fail: (error) => {
            if (error.errMsg && error.errMsg.includes('Cloud API isn\'t enabled')) {
              reject(new Error('云开发未正确配置'));
            } else if (error.errMsg && error.errMsg.includes('cloud function')) {
              // 云函数不存在但云开发可用
              resolve();
            } else {
              reject(new Error(error.errMsg || '云开发连接失败'));
            }
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },



  /**
   * 刷新二维码
   */
  refreshQRCode() {
    this.generateQRCode();
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
   * 分享邀请
   */
  shareInvite() {
    if (!this.data.inviteCode) {
      wx.showToast({ title: '邀请信息未生成', icon: 'none' });
      return;
    }

    // 触发分享
    wx.showShareMenu({
      withShareTicket: true,
      success: () => {
        console.log('分享菜单显示成功');
      }
    });
  },

  // QA-FIX: A3 删除重复的 onShareAppMessage 定义，保留下方统一实现

  /**
   * 创建对局并跳转记分页面
   */
  startScoring() {
    const participants = this.data.participants.map(p => p.name);
    if (participants.length === 0) {
      wx.showToast({ title: '请添加参与者', icon: 'none' });
      return;
    }

    // 使用已生成的sessionId或创建新的
    const sessionId = this.data.sessionId || Date.now();
    
    const session = {
      id: sessionId,
      participants,
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
   * QA-FIX: A3 统一 onShareAppMessage（仅一处）
   */
  onShareAppMessage() {
    const { sessionId: sid, inviteToken: token, shareImageUrl } = this.data || {};
    const path = `/pages/invite/join/index?sid=${encodeURIComponent(sid)}&token=${encodeURIComponent(token)}`;
    console.log('[SHARE] path=', path, 'imageUrl=', shareImageUrl);
    return {
      title: `邀请你加入麻将计分，邀请码：${(token||'').toUpperCase()}`,
      path,
      imageUrl: shareImageUrl || '/assets/share-card.png'
    };
  },

  /**
   * 页面显示时开启分享
   */
  onShow() {
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] });
  }
});