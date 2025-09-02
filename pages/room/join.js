const app = getApp();
const config = require('../../config.js');

/**
 * 解析小程序码场景值
 */
function parseScene(scene) {
  const obj = {};
  if (!scene) return obj;
  
  try {
    scene.split('&').forEach(kv => {
      const i = kv.indexOf('='); 
      if (i > -1) {
        const key = decodeURIComponent(kv.slice(0, i));
        const value = decodeURIComponent(kv.slice(i + 1));
        obj[key] = value;
      }
    });
  } catch (error) {
    console.error('解析场景值失败:', error);
  }
  
  return obj;
}

/**
 * 验证房间ID有效性
 */
function validateRoomId(roomId) {
  if (!roomId || typeof roomId !== 'string') {
    return { valid: false, message: '房间号不能为空' };
  }
  
  if (roomId.length < 3 || roomId.length > 20) {
    return { valid: false, message: '房间号长度不符合要求' };
  }
  
  // 简单的格式验证
  if (!/^[a-zA-Z0-9]+$/.test(roomId)) {
    return { valid: false, message: '房间号格式不正确' };
  }
  
  return { valid: true };
}

Page({
  data: { 
    roomId: '', 
    inviteCode: '',
    status: 'loading', 
    errMsg: '',
    progress: 0
  },

  onLoad(options) {
    console.log('[JOIN] 页面加载参数:', options);
    this.parseParams(options);
  },

  /**
   * 解析页面参数
   */
  parseParams(options) {
    let roomId = '';
    let inviteCode = '';
    
    // 优先从直接参数获取
    if (options.meetingId) {
      roomId = options.meetingId;
      inviteCode = options.invite || '';
    } else if (options.roomId) {
      roomId = options.roomId;
    }
    
    // 如果没有直接参数，尝试解析场景值
    if (!roomId && options.scene) {
      try {
        const sceneParams = parseScene(decodeURIComponent(options.scene));
        roomId = sceneParams.meetingId || sceneParams.roomId || sceneParams.r || '';
        inviteCode = sceneParams.invite || sceneParams.token || '';
      } catch (error) {
        console.error('[JOIN] 解析场景值失败:', error);
      }
    }
    
    // 验证房间ID
    const validation = validateRoomId(roomId);
    if (!validation.valid) {
      return this.fail(validation.message);
    }
    
    this.setData({ 
      roomId, 
      inviteCode,
      progress: 20 
    });
    
    // 开始加入流程
    this.startJoinProcess();
  },

  /**
   * 开始加入流程
   */
  async startJoinProcess() {
    wx.showLoading({ title: '正在加入房间...' });
    
    try {
      // Step 1: 确保登录
      this.setData({ progress: 40 });
      await app.ensureLogin();
      
      // Step 2: 调用加入房间云函数
      this.setData({ progress: 70 });
      const res = await wx.cloud.callFunction({ 
        name: config.cloudFunctions.joinRoom, 
        data: { roomId: this.data.roomId } 
      });
      
      const result = (res && res.result) || {};
      
      if (result.code === 0) {
        this.setData({ progress: 100 });
        wx.hideLoading();
        
        // 加入成功，跳转到计分页面
        wx.showToast({ 
          title: '加入成功', 
          icon: 'success',
          duration: 1000 
        });
        
        setTimeout(() => {
          wx.redirectTo({ 
            url: `${config.pages.scoring}?roomId=${this.data.roomId}` 
          });
        }, 1000);
      } else {
        wx.hideLoading();
        this.handleJoinError(result);
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[JOIN] 加入房间失败:', error);
      this.fail('网络异常，请稍后重试');
    }
  },

  /**
   * 处理加入错误
   */
  handleJoinError(result) {
    let errorMsg = '加入失败';
    
    switch (result.code) {
      case config.errorCodes.ROOM_NOT_FOUND:
        errorMsg = '房间不存在或已解散';
        break;
      case config.errorCodes.ROOM_FULL:
        errorMsg = '房间已满，无法加入';
        break;
      case config.errorCodes.ROOM_CLOSED:
        errorMsg = '房间已关闭';
        break;
      case config.errorCodes.NO_OPENID:
        errorMsg = '登录状态异常，请重试';
        break;
      default:
        errorMsg = result.message || '加入失败，请重试';
    }
    
    this.fail(errorMsg);
  },

  /**
   * 显示失败状态
   */
  fail(msg) {
    this.setData({ 
      status: 'error', 
      errMsg: msg || '加入失败',
      progress: 0
    });
    
    wx.showToast({ 
      icon: 'none', 
      title: msg || '加入失败',
      duration: 2000
    });
  },

  /**
   * 重试加入
   */
  retryJoin() {
    this.setData({ 
      status: 'loading', 
      errMsg: '',
      progress: 0
    });
    this.startJoinProcess();
  },

  /**
   * 返回首页
   */
  goHome() { 
    try { 
      wx.switchTab({ url: config.pages.index }); 
    } catch (e) { 
      wx.reLaunch({ url: config.pages.index }); 
    }
  }
});

