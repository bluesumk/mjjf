Page({
  data: { 
    avatarUrl: '', 
    nickName: '',
    avatarFileID: '',
    loading: false
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
      
      const profileRes = await wx.getUserProfile({
        desc: '用于获取微信昵称'
      });
      
      const wxNickname = profileRes.userInfo.nickName;
      if (wxNickname) {
        this.setData({ nickName: wxNickname });
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
      
      // 1. 获取微信用户信息
      const profileRes = await wx.getUserProfile({
        desc: '用于更新头像'
      });
      
      const wxAvatarUrl = profileRes.userInfo.avatarUrl;
      if (!wxAvatarUrl) {
        wx.hideLoading();
        wx.showToast({ title: '未获取到微信头像', icon: 'none' });
        return;
      }

      wx.showLoading({ title: '处理头像中...' });
      
      // 2. 使用 getImageInfo 获取图片信息并下载
      const imageInfo = await wx.getImageInfo({
        src: wxAvatarUrl
      });
      
      // 3. 上传到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `avatars/wx_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`,
        filePath: imageInfo.path
      });
      
      // 4. 获取临时URL用于显示
      const { fileList } = await wx.cloud.getTempFileURL({
        fileList: [uploadRes.fileID]
      });
      
      const tempFileURL = fileList[0].tempFileURL;
      
      this.setData({ 
        avatarUrl: tempFileURL,
        avatarFileID: uploadRes.fileID
      });
      
      wx.hideLoading();
      wx.showToast({ title: '微信头像已设置', icon: 'success' });
      
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
   * 修改昵称（参考头像的交互方案）
   */
  async changeNickname() {
    const actions = ['用微信昵称', '手动输入', '取消'];
    wx.showActionSheet({
      itemList: actions.slice(0, 2),
      success: async res => {
        const i = res.tapIndex;
        if (i === 0) {
          // 使用微信昵称
          await this.useWechatNick();
        } else if (i === 1) {
          // 手动输入昵称
          this.showNicknameInput();
        }
      }
    });
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
      // 构建用户信息
      const userInfo = {
        nickName: name,
        avatarFileID: this.data.avatarFileID || '',
        avatarUrl: this.data.avatarUrl || ''
      };
      
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
        const updatedUserInfo = {
          nickName: name,
          avatarUrl: this.data.avatarUrl,
          avatarFileID: this.data.avatarFileID,
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
