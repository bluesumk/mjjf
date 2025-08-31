Page({
  data: { 
    avatarUrl: '', 
    nickName: '' 
  },
  
  onLoad() {
    const app = getApp();
    const prof = wx.getStorageSync('userProfile') || app.globalData?.userProfile || {};
    this.setData({ 
      avatarUrl: prof.avatarUrl, 
      nickName: prof.nickName || prof.nickname || '' 
    });
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
  
  onSave() {
    // 最小校验：昵称 1-20
    const name = (this.data.nickName || '').trim();
    if (name.length === 0 || name.length > 20) {
      wx.showToast({ title: '请输入1-20位昵称', icon: 'none' }); 
      return;
    }
    
    // 本地回写 + 全局回写（保持原有后端/云端保存逻辑不变）
    const prof = { avatarUrl: this.data.avatarUrl, nickName: name };
    wx.setStorageSync('userProfile', prof);
    const app = getApp(); 
    app.globalData = app.globalData || {}; 
    app.globalData.userProfile = prof;

    // 如果项目已有保存到云端的逻辑，继续调用原有方法（留钩子）：
    if (typeof this.saveProfileToCloud === 'function') {
      this.saveProfileToCloud(prof).finally(() => {
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 300);
      });
    } else {
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 300);
    }
  }
});
