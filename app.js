// app.js
// 全局应用实例
App({
  globalData: {
    /**
     * 所有对局列表，每个对局包含参与者、轮次、状态和最终分数
     * {
     *   id: Number, // 唯一标识
     *   participants: Array<String>, // 参与者姓名
     *   taiSwitch: Boolean, // 是否开启台版
     *   rounds: Array<{scores: Object}>, // 每一局的得分结果
     *   multiplier: Number, // 收盘时的倍率
     *   createdAt: String, // 创建时间 ISO 字符串
     *   status: 'ongoing' | 'finished', // 状态
     *   finalScores: Object | null // 最终分数
     * }
     */
    sessions: [],
    /** 当前进行中的对局 ID */
    currentSessionId: null,
  },
  onLaunch() {
    // 启动时尝试从本地存储读取已有的对局记录
    try {
      const sessions = wx.getStorageSync('sessions');
      if (sessions) {
        this.globalData.sessions = sessions;
      }
    } catch (e) {
      console.warn('读取本地会话失败', e);
    }
  },
  /**
   * 保存会话数据到本地存储
   */
  saveSessions() {
    try {
      wx.setStorageSync('sessions', this.globalData.sessions);
    } catch (e) {
      console.error('保存本地会话失败', e);
    }
  }
});