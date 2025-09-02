Page({
  data: {
    sid: '',
    token: '',
    canJoin: false,
    error: ''
  },

  async onLoad(options) {
    // QA-FIX: A7 JOIN 日志补全
    try {
      const enter = (wx.getEnterOptionsSync && wx.getEnterOptionsSync()) || {};
      console.log('[JOIN] getEnterOptionsSync=', enter);
    } catch(e){}
    console.log('[JOIN] onLoad options=', options);
    
    const parseScene = (s='') => {
      // 兼容 "s=xxx&t=yyy" 或 "xxx.yyy" 两种编码
      try {
        const dec = decodeURIComponent(s);
        if (dec.includes('=')) {
          const m = new URLSearchParams(dec);
          return { sid: m.get('s') || m.get('sid'), token: m.get('t') || m.get('token') };
        }
        if (dec.includes('.')) {
          const [sid, token] = dec.split('.');
          return { sid, token };
        }
        return { sid: dec, token: '' };
      } catch { return { sid:'', token:'' }; }
    };

    let { sid, token } = options || {};
    if ((!sid || !token) && options.scene) {
      const o = parseScene(options.scene);
      sid = sid || o.sid;
      token = token || o.token;
    }

    console.log('[JOIN] 解析参数:', { sid, token, scene: options.scene });
    console.log('[JOIN] 分享卡片跳转路径:', `/pages/invite/join/index?sid=${sid}&token=${token}`);

    if (!sid || !token) {
      this.setData({ error: '参数缺失，请通过分享链接进入' });
      return;
    }

    // 调 session.validate
    wx.cloud.callFunction({
      name:'session',
      data:{ action:'validate', sid, token }
    }).then(res => {
      console.log('[JOIN] validate ok', res);
      this.setData({ sid, token, canJoin: true });
      // 进入牌局...
    }).catch(err => {
      console.error('[JOIN] validate fail', err);
      // 显示 "无法加入牌局" 提示
      this.setData({ error: '无法加入牌局' });
    });
  },

  /**
   * 加入牌局
   */
  joinSession() {
    if (!this.data.canJoin) {
      wx.showToast({ title: '无法加入牌局', icon: 'none' });
      return;
    }

    // TODO: 实现具体的加入逻辑
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  /**
   * 返回首页
   */
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});