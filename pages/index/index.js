// pages/index/index.js
const app = getApp();

Page({
  /**
   * 首页用于导航至邀请页面和查看记录
   */
  data: {
    // 显示的昵称，可根据实际场景替换
    nickname: '弓长',
    // 当前月份
    currentMonth: '',
    // 月度统计
    monthStats: {
      totalGames: 0,
      winRate: 0,
      totalScore: 0
    },
    // 最近对局
    recentGames: []
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  /**
   * 加载首页数据
   */
  loadData() {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    
    this.setData({
      currentMonth: currentMonth
    });

    this.loadMonthStats();
    this.loadRecentGames();
  },

  /**
   * 加载月度统计
   */
  loadMonthStats() {
    try {
      const sessions = app.globalData.sessions || [];
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      
      // 筛选当月的已结束对局
      const monthSessions = sessions.filter(session => {
        if (session.status !== 'finished') return false;
        
        const sessionDate = new Date(session.endTime || session.startTime);
        return sessionDate.getFullYear() === currentYear && 
               sessionDate.getMonth() + 1 === currentMonth;
      });

      let totalGames = monthSessions.length;
      let totalScore = 0;
      let wins = 0;

      monthSessions.forEach(session => {
        if (session.finalScores && session.finalScores[this.data.nickname]) {
          const myScore = session.finalScores[this.data.nickname];
          totalScore += myScore;
          if (myScore > 0) wins++;
        }
      });

      const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

      this.setData({
        monthStats: {
          totalGames,
          winRate,
          totalScore
        }
      });
    } catch (error) {
      console.error('加载月度统计失败:', error);
      this.setData({
        monthStats: {
          totalGames: 0,
          winRate: 0,
          totalScore: 0
        }
      });
    }
  },

  /**
   * 加载最近对局
   */
  loadRecentGames() {
    try {
      const sessions = app.globalData.sessions || [];
      
      // 筛选已结束的对局，按结束时间倒序排列
      const finishedSessions = sessions
        .filter(session => session.status === 'finished')
        .sort((a, b) => {
          const timeA = new Date(a.endTime || a.startTime).getTime();
          const timeB = new Date(b.endTime || b.startTime).getTime();
          return timeB - timeA;
        })
        .slice(0, 3); // 只取最近3局

      const recentGames = finishedSessions.map(session => {
        const endDate = new Date(session.endTime || session.startTime);
        const dateStr = `${endDate.getMonth() + 1}月${endDate.getDate()}日`;
        
        const playersText = session.participants.slice(0, 3).join('、') + 
                           (session.participants.length > 3 ? '等' : '');
        
        const myScore = session.finalScores && session.finalScores[this.data.nickname] 
          ? session.finalScores[this.data.nickname] 
          : 0;

        return {
          id: session.id,
          date: dateStr,
          playersText,
          myScore
        };
      });

      this.setData({
        recentGames
      });
    } catch (error) {
      console.error('加载最近对局失败:', error);
      this.setData({
        recentGames: []
      });
    }
  },

  /**
   * 跳转到邀请页面
   */
  goInvite() {
    wx.navigateTo({ url: '/pages/invite/invite' });
  },

  /**
   * 跳转到记录页面
   */
  goRecords() {
    wx.switchTab({ url: '/pages/records/records' });
  },

  /**
   * 查看对局详情
   */
  viewGameDetail(e) {
    const gameId = e.currentTarget.dataset.id;
    // 这里可以跳转到对局详情页面，目前先跳转到记录页面
    this.goRecords();
  }
});