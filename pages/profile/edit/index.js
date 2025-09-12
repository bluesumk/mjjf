Page({
  data: { 
    avatarUrl: '', 
    nickName: '',
    avatarFileID: '',
    loading: false
  },
  // 空操作：用于 catchtap 阻止冒泡
  noop() {},
  /**
   * 官方 open-type=chooseAvatar 回调
   */
  onChooseAvatarWx(e) {
    try {
      const avatarUrl = e?.detail?.avatarUrl || '';
      if (!avatarUrl) { wx.showToast({ title:'未获取到微信头像', icon:'none' }); return; }
      this.setData({ avatarUrl, avatarFileID: '' });
      try {
        const app = getApp();
        const current = app.globalData.userInfo || {};
        app.globalData.userInfo = Object.assign({}, current, { avatarUrl, avatarFileID: '' });
        wx.setStorageSync('userInfo', app.globalData.userInfo);
      } catch(_) {}
      wx.showToast({ title:'已选择微信头像', icon:'success' });
    } catch (err) {
      wx.showToast({ title:'获取头像失败', icon:'none' });
    }
  },
  
  async onLoad(options) {
    console.log('[PROFILE_EDIT] 页面加载');
    
    // 从全局数据获取当前用户信息
    const app = getApp();
    const globalUserInfo = app.globalData.userInfo || {};
    
    this.setData({
      nickName: globalUserInfo.nickName || '',
      avatarUrl: globalUserInfo.avatarUrl || '',
      avatarFileID: globalUserInfo.avatarFileID || ''
    });
    
    console.log('[PROFILE_EDIT] 初始用户信息:', globalUserInfo);
  },
  
  /**
   * 使用微信昵称
   */
  async useWechatNick() {
    try {
      wx.showLoading({ title: '获取微信昵称中...' });
      
      // 官方接口：需用户主动触发
      if (!wx.getUserProfile) {
        wx.hideLoading();
        wx.showToast({ title:'微信版本过低', icon:'none' });
        return;
      }
      const profileRes = await wx.getUserProfile({ desc: '用于完善资料' });
      const wxNickname = profileRes?.userInfo?.nickName;
      if (wxNickname) {
        this.setData({ nickName: wxNickname });
        // 同时把用户对象中的 nickName 更新，避免返回“我的”页显示旧昵称
        try {
          const app = getApp();
          const current = app.globalData.userInfo || {};
          app.globalData.userInfo = Object.assign({}, current, { nickName: wxNickname });
          wx.setStorageSync('userInfo', app.globalData.userInfo);
        } catch(_) {}
        wx.hideLoading();
        wx.showToast({ title: '昵称已更新', icon: 'success' });
      } else {
        wx.hideLoading();
        wx.showToast({ title: '未获取到微信昵称', icon: 'none' });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[PROFILE_EDIT] 获取微信昵称失败:', error);
      if (error.errMsg && error.errMsg.includes('auth deny')) {
        wx.showToast({ title: '用户取消授权', icon: 'none' });
      } else {
        wx.showToast({ title: '获取微信昵称失败', icon: 'none' });
      }
    }
  },

  /**
   * 使用微信头像
   */
  async useWechatAvatar() {
    try {
      wx.showLoading({ title: '获取微信头像中...' });
      
      // 1) 统一从 getUserProfile 获取头像 URL
      const profileRes = await wx.getUserProfile({ desc: '获取用户信息' });
      let avatarUrl = profileRes?.userInfo?.avatarUrl || '';
      if (!avatarUrl) { wx.hideLoading(); wx.showToast({ title: '未获取到微信头像', icon: 'none' }); return; }

      // 2) 规范化与候选构造
      // 强制 https
      const httpsUrl = avatarUrl.replace(/^http:\/\//i, 'https://');
      // 域名替换：thirdwx.qlogo.cn → wx.qlogo.cn
      const swapped = httpsUrl.replace('thirdwx.qlogo.cn', 'wx.qlogo.cn');
      // 去重候选
      const candidates = Array.from(new Set([httpsUrl, swapped]));

      // 3) 逐个尝试下载→上传；失败则优雅回退使用外链
      // 说明：需在 downloadFile 合法域名添加 https://thirdwx.qlogo.cn 与 https://wx.qlogo.cn，
      // 修改后请在开发者工具“详情→域名信息→刷新”，清缓存并重新编译。
      const tryFetchAvatar = async (urls) => {
        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          try {
            const imageInfo = await wx.getImageInfo({ src: url });
            const uploadRes = await wx.cloud.uploadFile({
              cloudPath: `avatars/wx_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`,
              filePath: imageInfo.path
            });
            const { fileList } = await wx.cloud.getTempFileURL({ fileList: [uploadRes.fileID] });
            const tempFileURL = fileList?.[0]?.tempFileURL || '';
            this.setData({ avatarUrl: tempFileURL || url, avatarFileID: uploadRes.fileID });
            wx.hideLoading();
            wx.showToast({ title: '头像已更新', icon: 'success' });
            return true;
          } catch (err) {
            const msg = (err && (err.errMsg || err.message)) || '';
            const domainBlocked = /not in (downloadFile )?domain list/i.test(msg) || /not in domain list/i.test(msg);
            console.warn('[PROFILE_EDIT] 下载失败，尝试下一个候选:', url, msg);
            if (!domainBlocked) {
              // 非域名问题也继续尝试下一个，最终统一回退
            }
          }
        }
        return false;
      };

      const ok = await tryFetchAvatar(candidates);
      if (!ok) {
        // 候选全部失败：使用外链，避免阻断
        this.setData({ avatarUrl: candidates[0], avatarFileID: '' });
        wx.hideLoading();
        wx.showToast({ title: '已使用微信头像（外链）', icon: 'none' });
      }
      
    } catch (error) {
      wx.hideLoading();
      console.error('[PROFILE_EDIT] 获取微信头像失败:', error);
      if (error.errMsg && error.errMsg.includes('auth deny')) {
        wx.showToast({ title: '用户取消授权', icon: 'none' });
      } else {
        wx.showToast({ title: '获取微信头像失败', icon: 'none' });
      }
    }
  },

  /**
   * 自定义头像上传
   */
  async uploadCustomAvatar(sourceType) {
    try {
      wx.showLoading({ title: '选择图片中...' });
      
      const r = await wx.chooseImage({ 
        count: 1, 
        sizeType: ['compressed'], 
        sourceType 
      });
      
      if (r.tempFilePaths && r.tempFilePaths.length > 0) {
        wx.showLoading({ title: '上传头像中...' });
        
        // 上传到云存储
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `avatars/custom_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`,
          filePath: r.tempFilePaths[0]
        });
        
        // 获取临时URL用于显示
        const { fileList } = await wx.cloud.getTempFileURL({
          fileList: [uploadRes.fileID]
        });
        
        const tempFileURL = fileList[0].tempFileURL;
        
        this.setData({ 
          avatarUrl: tempFileURL,
          avatarFileID: uploadRes.fileID
        });
        
        wx.hideLoading();
        wx.showToast({ title: '头像已上传', icon: 'success' });
      } else {
        wx.hideLoading();
        wx.showToast({ title: '未选择图片', icon: 'none' });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('[PROFILE_EDIT] 上传头像失败:', error);
      if (error.errMsg && error.errMsg.includes('cancel')) {
        // 用户取消选择，不显示错误
      } else {
        wx.showToast({ title: '上传头像失败', icon: 'none' });
      }
    }
  },

  /**
   * 昵称输入处理（官方 input type="nickname"）
   */
  onNicknameInput(e) {
    const nickName = e.detail.value;
    this.setData({ nickName });
    
    // 同步到全局数据
    try {
      const app = getApp();
      const current = app.globalData.userInfo || {};
      app.globalData.userInfo = Object.assign({}, current, { nickName });
      wx.setStorageSync('userInfo', app.globalData.userInfo);
    } catch(_) {}
  },

  /**
   * 昵称输入完成处理
   */
  onNicknameBlur(e) {
    const nickName = (e.detail.value || '').trim();
    if (!nickName) {
      this.setData({ nickName: '请设置昵称' });
      return;
    }
    
    // 微信会自动进行内容安全检测，如果不通过会清空内容
    console.log('[PROFILE_EDIT] 昵称输入完成:', nickName);
  },

  /**
   * 显示昵称输入弹窗
   */
  showNicknameInput() {
    wx.showModal({
      title: '修改昵称',
      content: '请输入新昵称（1-20个字符）',
      placeholderText: this.data.nickName || '请输入昵称',
      editable: true,
      success: (res) => {
        if (res.confirm && res.content) {
          const newNickname = res.content.trim();
          if (newNickname.length > 0 && newNickname.length <= 20) {
            this.setData({ nickName: newNickname });
            wx.showToast({ title: '昵称已更新', icon: 'success' });
          } else {
            wx.showToast({ title: '昵称长度需在1-20个字符', icon: 'none' });
          }
        }
      }
    });
  },
  
  async changeAvatar() {
    const actions = ['用微信头像','从相册选择','拍照','取消'];
    wx.showActionSheet({
      itemList: actions.slice(0,3),
      success: async res => {
        const i = res.tapIndex;
        if(i === 0) {
          // 使用微信头像
          await this.useWechatAvatar();
        } else {
          // 自定义头像上传
          await this.uploadCustomAvatar(i === 1 ? ['album'] : ['camera']);
        }
      }
    });
  },
  
  /**
   * 保存资料
   */
  async saveProfile() {
    const name = (this.data.nickName || '').trim();
    if (name.length === 0 || name.length > 20) {
      wx.showToast({ title: '请输入1-20位昵称', icon: 'none' }); 
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '保存中...' });
    
    try {
      // 若选择的是本地临时头像（chooseAvatar/相册/拍照），优先上传到云存储
      let avatarFileID = this.data.avatarFileID || '';
      let avatarUrlLocal = this.data.avatarUrl || '';
      try {
        const isLocal = /^wxfile:\/\//i.test(avatarUrlLocal);
        if (!avatarFileID && isLocal) {
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath: `avatars/wx_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`,
            filePath: avatarUrlLocal
          });
          avatarFileID = uploadRes.fileID;
          // 获取临时URL用于立即展示
          const { fileList } = await wx.cloud.getTempFileURL({ fileList: [avatarFileID] });
          const tmpUrl = (fileList && fileList[0] && fileList[0].tempFileURL) || '';
          if (tmpUrl) avatarUrlLocal = tmpUrl;
        }
      } catch (_) {}

      // 构建用户信息
      const userInfo = {
        nickName: name,
        avatarFileID: avatarFileID,
        avatarUrl: avatarUrlLocal
      };
      
      // 可选提示：若仍为外链且无 fileID（例如低版本/下载失败场景），提示一次
      try {
        const isExternal = /^https?:\/\//.test(userInfo.avatarUrl) && !userInfo.avatarFileID;
        if (isExternal) {
          wx.showToast({ title: '当前头像为临时外链，建议配置域名后重试上传', icon: 'none', duration: 2500 });
        }
      } catch(_) {}
      
      console.log('[PROFILE_EDIT] 保存用户信息:', userInfo);
      
      // 调用 updateuser 云函数
      const saveResult = await wx.cloud.callFunction({
        name: 'updateuser',
        data: { userInfo }
      });

      console.log('[PROFILE_EDIT] 云函数返回:', saveResult.result);

      if (saveResult.result && saveResult.result.ok) {
        // 保存成功，更新全局数据和缓存
        const app = getApp();
        
        // 优先刷新一次临时URL，避免返回“我的”页出现过期403
        let finalAvatarUrl = avatarUrlLocal || '';
        try {
          if (userInfo.avatarFileID && wx.cloud && wx.cloud.getTempFileURL) {
            const { fileList } = await wx.cloud.getTempFileURL({ fileList: [userInfo.avatarFileID] });
            const freshUrl = (fileList && fileList[0] && fileList[0].tempFileURL) || '';
            if (freshUrl) finalAvatarUrl = freshUrl;
          }
        } catch (_) {}
        
        const updatedUserInfo = {
          nickName: name,
          avatarUrl: finalAvatarUrl,
          avatarFileID: userInfo.avatarFileID,
          synced: true,
          isDefault: false
        };
        
        // 更新全局数据
        app.globalData.userInfo = updatedUserInfo;
        
        // 更新本地缓存
        wx.setStorageSync('userInfo', updatedUserInfo);
        
        console.log('[PROFILE_EDIT] 数据同步完成');
        
        wx.hideLoading();
        wx.showToast({ title: '资料保存成功', icon: 'success' });
        
        // 延迟返回，让用户看到成功提示
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
        
      } else {
        const errorMsg = saveResult.result?.message || '保存失败';
        wx.hideLoading();
        wx.showToast({ title: errorMsg, icon: 'none', duration: 3000 });
      }

    } catch (error) {
      console.error('[PROFILE_EDIT] 保存失败:', error);
      wx.hideLoading();
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // 保持向后兼容
  async onSave() {
    await this.saveProfile();
  }
});
