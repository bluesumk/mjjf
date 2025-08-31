// pages/session-detail/session-detail.js
const app = getApp();

Page({
  data: {
    sessionId: null,
    sessionInfo: null,
    participants: [], // 参与者信息（包括累计分数）
    rounds: [] // 每局记录
  },

  onLoad(options) {
    const sessionId = parseInt(options.sessionId);
    this.setData({ sessionId });
    this.loadSessionData();
  },

  /**
   * 加载对局数据
   */
  loadSessionData() {
    const sessionId = this.data.sessionId;
    const sessions = app.globalData.sessions;
    const session = sessions.find(s => s.id === sessionId);
    
    if (!session) {
      wx.showToast({ title: '对局不存在', icon: 'error' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    if (session.status !== 'finished') {
      wx.showToast({ title: '只能查看已结束的对局', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // 计算参与者信息
    const participants = this.calculateParticipants(session);
    
    // 处理每局记录
    const rounds = this.processRounds(session);
    
    this.setData({
      sessionInfo: session,
      participants,
      rounds
    });

    // 设置导航栏标题
    wx.setNavigationBarTitle({ title: '对局详情' });
  },

  /**
   * 计算参与者信息（包括累计分数）
   */
  calculateParticipants(session) {
    const participantNames = session.participants.slice();
    if (session.taiSwitch) {
      participantNames.push('台');
    }

    // 计算每个参与者的累计分数
    const totalScores = {};
    participantNames.forEach(name => {
      totalScores[name] = 0;
    });

    // 累加每一局的分数
    session.rounds.forEach(round => {
      Object.keys(round.scores).forEach(name => {
        if (totalScores.hasOwnProperty(name)) {
          totalScores[name] += round.scores[name] || 0;
        }
      });
    });

    // 生成参与者数据
    return participantNames.map(name => ({
      name,
      totalScore: totalScores[name] || 0,
      avatarColor: this.getPlayerColor(name)
    }));
  },

  /**
   * 处理每局记录
   */
  processRounds(session) {
    const participantNames = session.participants.slice();
    if (session.taiSwitch) {
      participantNames.push('台');
    }

    return session.rounds.map(round => {
      // 格式化时间
      const date = new Date(round.timestamp);
      const displayTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
      
      // 生成每个参与者的分数
      const scoreList = participantNames.map(name => ({
        name,
        value: round.scores[name] || 0
      }));
      
      return {
        timestamp: round.timestamp,
        displayTime,
        scores: round.scores,
        scoreList
      };
    }).reverse(); // 按时间倒序，最新的在前面
  },

  /**
   * 获取玩家头像颜色
   */
  getPlayerColor(name) {
    const colors = [
      '#1ec5c9', // 青色
      '#9a69e5', // 紫色
      '#e54db1', // 粉色
      '#5a9dff', // 蓝色
      '#ff8b44', // 橙色
      '#4caf50', // 绿色
      '#ff5722', // 红橙色
      '#795548'  // 棕色
    ];
    
    if (name === '台') {
      return '#5a9dff'; // 台版专用蓝色
    }
    
    // 根据名字生成稳定的颜色
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  },

  /**
   * 查看排行榜详情
   */
  viewRanking() {
    const sessionId = this.data.sessionId;
    wx.navigateTo({
      url: `/pages/ranking/ranking?sessionId=${sessionId}`
    });
  },


});
