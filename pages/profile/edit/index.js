Page({
  data: { 
    avatarUrl: '', 
    nickName: '' 
  },
  
  async onLoad() {
    const { result } = await wx.cloud.callFunction({ name:'profile', data:{ action:'get' }});
    const d = result?.data || {};
    let avatarUrl = d.avatarUrl || '';
    if (d.avatarFileID) {
      const { fileList } = await wx.cloud.getTempFileURL({ fileList:[d.avatarFileID] });
      avatarUrl = fileList?.[0]?.tempFileURL || avatarUrl;
    }
    this.setData({ nickName: d.nickName || '', avatarUrl });
  },
  
  onNameInput(e) { 
    this.setData({ nickName: e.detail.value.trim() }); 
  },
  
  async changeAvatar() {
    const actions = ['用微信头像','从相册选择','拍照','取消'];
    wx.showActionSheet({
      itemList: actions.slice(0,3),
      success: async res => {
        const i = res.tapIndex;
        if(i === 0) {
          // 直接用当前微信头像（需先在登录处保存过）
          const wxAvatar = getApp().globalData?.wxAvatarUrl;
          if(wxAvatar) {
            this.setData({ avatarUrl: wxAvatar });
          } else {
            wx.showToast({ title: '请先登录获取微信头像', icon: 'none' });
          }
        } else {
          try {
            const count = 1;
            const sourceType = i === 1 ? ['album'] : (i === 2 ? ['camera'] : ['album','camera']);
            const r = await wx.chooseImage({ 
              count, 
              sizeType: ['compressed'], 
              sourceType 
            });
            this.setData({ avatarUrl: r.tempFilePaths[0] });
          } catch (error) {
            console.error('选择图片失败:', error);
          }
        }
      }
    });
  },
  
  async onSave() {
    // 最小校验：昵称 1-20
    const name = (this.data.nickName || '').trim();
    if (name.length === 0 || name.length > 20) {
      wx.showToast({ title: '请输入1-20位昵称', icon: 'none' }); 
      return;
    }

    wx.showLoading({ title: '保存中...' });
    
    try {
      // 先校验昵称可用性
      const checkResult = await wx.cloud.callFunction({
        name: 'profile',
        data: { action: 'checkNick', nickName: name }
      });
      
      if (!checkResult.result?.ok) {
        const error = checkResult.result?.error || {};
        wx.showToast({ title: error.msg || '昵称校验失败', icon: 'none' });
        return;
      }

      // 保存到云端
      const saveResult = await wx.cloud.callFunction({
        name: 'profile',
        data: { 
          action: 'upsert', 
          nickName: name,
          avatarUrl: this.data.avatarUrl 
        }
      });

      if (!saveResult.result?.ok) {
        const error = saveResult.result?.error || {};
        wx.showToast({ title: error.msg || '保存失败', icon: 'none' });
        return;
      }

      // 同步到本地存储和全局状态
      const prof = { avatarUrl: this.data.avatarUrl, nickName: name };
      wx.setStorageSync('userProfile', prof);
      const app = getApp(); 
      app.globalData = app.globalData || {}; 
      app.globalData.userProfile = prof;

      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 300);

    } catch (e) {
      console.error('[PROFILE] 保存失败:', e);
      wx.showToast({ title: '网络错误，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
