// pages/index/index.js
const app = getApp();
const config = require('../../config.js');

Page({
  /**
   * 首页用于导航至邀请页面和查看记录
   */
  data: {
    // 显示的昵称，从认证管理器获取
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
    recentGames: [],
    // 新增：房间号
    roomId: ""
  },

  onLoad() {
    this.checkAuthAndLoadData();
  },

  onShow() {
    this.loadData();
    try { 
      wx.showShareMenu({ 
        withShareTicket: true, 
        menus: config.share.menus 
      }); 
    } catch (e) {
      console.warn('配置分享菜单失败:', e);
    }
  },

  /**
   * 检查授权状态并加载数据
   */
  async checkAuthAndLoadData() {
    try {
      const authManager = app.globalData.authManager;
      const loginResult = await authManager.login();
      
      if (loginResult.success) {
        // 已授权，直接加载数据
        console.log('用户已授权，加载首页数据');
        this.loadData();
      } else if (loginResult.needAuth) {
        // 需要授权，显示授权弹窗
        console.log('用户需要授权');
        this.showAuthModal();
      }
    } catch (error) {
      console.error('授权检查失败:', error);
      // 错误时使用默认流程
      this.loadData();
    }
  },

  /**
   * 用户点击授权按钮（推荐方式）
   */
  async onAuthorizeTap() {
    try {
      const authManager = app.globalData.authManager;
      const authResult = await authManager.requestUserAuth();
      
      if (authResult.success) {
        if (authResult.isDefault) {
          wx.showToast({ 
            title: '已使用默认身份', 
            icon: 'none',
            duration: 2000
          });
        } else {
          wx.showToast({ 
            title: '授权成功', 
            icon: 'success',
            duration: 1500
          });
        }
        // 重新加载数据以更新UI
        this.loadData();
      }
    } catch (error) {
      console.error('授权失败:', error);
      wx.showToast({ 
        title: '授权失败，请重试', 
        icon: 'none' 
      });
    }
  },

  /**
   * 显示授权弹窗（保留兼容，但建议改为按钮点击）
   */
  showAuthModal() {
    // 推荐：直接调用授权，不使用 showModal
    this.onAuthorizeTap();
  },

  /**
   * 执行授权
   */
  async performAuth() {
    try {
      const authManager = app.globalData.authManager;
      const authResult = await authManager.requestUserAuth();
      
      if (authResult.success) {
        if (authResult.isDefault) {
          wx.showToast({ 
            title: '已使用默认身份', 
            icon: 'none',
            duration: 2000
          });
        } else {
          wx.showToast({ 
            title: '授权成功', 
            icon: 'success',
            duration: 1500
          });
        }
      }
    } catch (error) {
      console.error('授权失败:', error);
      wx.showToast({ 
        title: '授权失败，使用默认身份', 
        icon: 'none' 
      });
      this.useDefaultUser();
    }
  },

  /**
   * 使用默认用户
   */
  useDefaultUser() {
    const authManager = app.globalData.authManager;
    const defaultUserInfo = {
      nickName: '弓长',
      avatarUrl: '/assets/avatar-placeholder.png',
      isDefault: true
    };
    authManager.saveUserInfoPublic(defaultUserInfo);
  },

  /**
   * 加载首页数据
   */
  loadData() {
    // 获取当前用户信息
    const authManager = app.globalData.authManager;
    const nickname = authManager.getNickname();
    const avatarUrl = authManager.getAvatarUrl();
    
    const now = new Date();
    const currentMonth = `${now.getFullYear()}年${now.getMonth() + 1}月`;
    
    this.setData({
      nickname: nickname,
      avatarUrl: avatarUrl,
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
   * 加载最近对局 - 最近一个月的3场对局（含进行中和已结束）
   */
  loadRecentGames() {
    try {
      const sessions = app.globalData.sessions || [];
      const now = new Date();
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      
      // 筛选最近一个月的对局（含进行中和已结束），按创建时间倒序排列
      const recentSessions = sessions
        .filter(session => {
          const sessionDate = new Date(session.createdAt);
          return sessionDate >= oneMonthAgo;
        })
        .sort((a, b) => {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          return timeB - timeA;
        })
        .slice(0, 3); // 只取最近3局

      if (recentSessions.length === 0) {
        this.setData({ recentGames: [] });
        return;
      }

      const recentGames = recentSessions.map(session => {
        const gameDate = new Date(session.createdAt);
        
        // 格式化时间显示
        let dateStr;
        if (gameDate.toDateString() === now.toDateString()) {
          // 今天：显示具体时间
          dateStr = `今天 ${gameDate.getHours().toString().padStart(2, '0')}:${gameDate.getMinutes().toString().padStart(2, '0')}`;
        } else if (gameDate.getFullYear() === now.getFullYear()) {
          // 今年：显示月日
          dateStr = `${gameDate.getMonth() + 1}月${gameDate.getDate()}日`;
        } else {
          // 其他年份：显示年月日
          dateStr = `${gameDate.getFullYear()}年${gameDate.getMonth() + 1}月${gameDate.getDate()}日`;
        }
        
        // 构建参与者列表（参照records页面格式）
        const names = session.participants.slice();
        if (session.taiSwitch) {
          names.push('台');
        }
        
        // 计算每个参与者的分数
        const playersList = names.map(name => {
          let score = 0;
          
          // 计算原始累计分数（不使用倍率）
          if (session.rounds && session.rounds.length > 0) {
            session.rounds.forEach(round => {
              if (round.scores && round.scores[name]) {
                score += round.scores[name] || 0;
              }
            });
          }
          
          return {
            name,
            score,
            avatarColor: this.getPlayerColor(name)
          };
        });

        return {
          id: session.id,
          status: session.status,
          date: dateStr,
          playersList,
          roundsCount: session.rounds ? session.rounds.length : 0
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
   * 获取玩家头像颜色
   */
  getPlayerColor(name) {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
      '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'
    ];
    
    if (name === '台') return '#95A5A6';
    
    // 根据姓名生成一个简单的哈希值
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  },

  /**
   * 跳转到邀请页面
   */
  goInvite() {
    wx.navigateTo({ url: '/pages/invite/invite' });
  },

  /**
   * 获取进行中的会话
   */
  getOngoingSession() {
    try {
      const sessions = app.globalData.sessions || [];
      return sessions.find(session => session.status === 'ongoing');
    } catch (error) {
      console.error('获取进行中会话失败:', error);
      return null;
    }
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
  },

  /**
   * 分享功能（统一会话模式）
   */
  onShareAppMessage() {
    const { sessionId, inviteToken } = this.data;
    
    if (!sessionId || !inviteToken) {
      return { 
        title: config.share.defaultTitle, 
        path: config.pages.index,
        imageUrl: config.share.defaultImageUrl
      };
    }
    
    return {
      title: `邀请你加入麻将局（房间 ${inviteToken.toUpperCase()}）`,
      path: `${config.pages.sessionJoin}?sid=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(inviteToken)}`,
      imageUrl: config.share.defaultImageUrl
    };
  }
});