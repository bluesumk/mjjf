// pages/rounds-detail/index.js
const app = getApp();

Page({
  data: {
    sessionId: null,
    participants: [],
    roundsList: []
  },

  onLoad(options) {
    if (options.sessionId) {
      this.setData({ sessionId: options.sessionId });
      this.loadGameData();
    } else {
      wx.showToast({ title: '参数错误', icon: 'error' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  /**
   * 加载游戏数据
   */
  loadGameData() {
    const { sessionId } = this.data;
    const sessions = app.globalData.sessions || [];
    const session = sessions.find(s => s.id == sessionId);
    
    if (!session) {
      wx.showToast({ title: '牌局不存在', icon: 'error' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    if (session.status !== 'finished') {
      wx.showToast({ title: '只能查看已结束的牌局', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // 处理参与者信息（包括台板和累计总分）
    const participants = this.processParticipants(session);

    // 处理每局明细
    const roundsList = this.processRounds(session);

    this.setData({
      participants,
      roundsList,
      hasTai: session.taiSwitch || false
    });

    // 设置导航栏标题
    wx.setNavigationBarTitle({ title: '牌局明细' });
  },

  /**
   * 处理参与者信息（包括台板和累计总分）
   */
  processParticipants(session) {
    const participantNames = session.participants.slice();
    
    // 如果开启了台板，添加"台"作为参与者
    if (session.taiSwitch) {
      participantNames.push('台');
    }

    // 计算每个参与者的累计总分
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

    // 生成参与者数据，包含头像颜色和累计总分
    return participantNames.map(name => ({
      name,
      avatarColor: this.getPlayerColor(name),
      totalScore: totalScores[name] || 0
    }));
  },

  /**
   * 处理每局数据
   */
  processRounds(session) {
    const rounds = session.rounds || [];
    const participantNames = session.participants.slice();
    
    // 如果开启了台板，添加"台"作为参与者
    if (session.taiSwitch) {
      participantNames.push('台');
    }
    
    return rounds.map((round, index) => {
      // 尝试多个可能的时间字段，兼容不同的数据结构
      const timestamp = round.timestamp || round.time || round.endTime || round.createdAt || Date.now();
      
      const time = this.formatRoundTime(timestamp);
      
      // 按照参与者顺序生成分数数组（包括台板）
      const allScores = participantNames.map(name => round.scores[name] || 0);
      
      return {
        roundNo: rounds.length - index, // 倒序显示，最新的在前面
        time,
        allScores
      };
    }).reverse(); // 按时间倒序，最新的在前面
  },



  /**
   * 格式化局次时间（详细版本）
   */
  formatRoundTimeDetailed(timestamp) {
    if (!timestamp) return '--:--:--';
    
    try {
      const date = new Date(timestamp);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      
      return `${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      return '--:--:--';
    }
  },

  /**
   * 格式化局次时间（简单版本）
   */
  formatRoundTime(timestamp) {
    if (!timestamp) {
      return '--:--:--';
    }
    
    try {
      const date = new Date(timestamp);
      
      if (isNaN(date.getTime())) {
        return '--:--:--';
      }
      
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const seconds = date.getSeconds().toString().padStart(2, '0');
      
      return `${hours}:${minutes}:${seconds}`;
    } catch (error) {
      return '--:--:--';
    }
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
    const { sessionId } = this.data;
    wx.navigateTo({
      url: `/pages/ranking/ranking?sessionId=${sessionId}`
    });
  }
});
