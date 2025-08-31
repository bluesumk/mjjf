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
    this.setData({ nickName: e.detail.value }); 
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
    const { avatarUrl, nickName } = this.data;
    if (!nickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    
    const prof = { avatarUrl, nickName: nickName.trim() };
    wx.setStorageSync('userProfile', prof);
    
    const app = getApp(); 
    app.globalData = app.globalData || {};
    app.globalData.userProfile = prof;
    
    wx.showToast({ title: '已保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 300);
  }
});
