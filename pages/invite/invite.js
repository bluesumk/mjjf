// pages/invite/invite.js
const app = getApp();

Page({
  data: {
    participants: [],
    taiSwitch: false,
    showAddModal: false,
    newName: ''
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
      participants: this.data.participants.concat([{ name }]),
      showAddModal: false,
      newName: ''
    });
  },
  /**
   * 创建对局并跳转记分页面
   */
  startScoring() {
    const participants = this.data.participants.map(p => p.name);
    if (participants.length === 0) {
      wx.showToast({ title: '请添加参与者', icon: 'none' });
      return;
    }
    const session = {
      id: Date.now(),
      participants,
      taiSwitch: this.data.taiSwitch,
      rounds: [],
      multiplier: 1,
      createdAt: new Date().toISOString(),
      status: 'ongoing',
      finalScores: null
    };
    app.globalData.sessions.push(session);
    app.globalData.currentSessionId = session.id;
    app.saveSessions();
    wx.navigateTo({ url: '/pages/scoring/scoring' });
  }
});