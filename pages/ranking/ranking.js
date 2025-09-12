// pages/ranking/ranking.js
const app = getApp();

Page({
  data: {
    sessionId: null,
    sessionInfo: null,
    rankings: [], // 排行榜数据
    title: '总分排行榜'
  },

  onLoad(options) {
    // 保持原始类型，在查找时进行兼容处理
    const sessionId = options.sessionId;
    this.setData({ sessionId });
    this.loadSessionData();
  },

  /**
   * 加载牌局数据并生成排行榜
   */
  loadSessionData() {
    const sessionId = this.data.sessionId;
    const sessions = app.globalData.sessions;
    // 兼容字符串和数字类型的sessionId，使用宽松比较
    const session = sessions.find(s => String(s.id) === String(sessionId));
    
    if (!session) {
      wx.showToast({ title: '牌局不存在', icon: 'error' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    // 计算最终排名
    const rankings = this.calculateRankings(session);
    
    this.setData({
      sessionInfo: session,
      rankings,
      title: `${session.participants.join('、')}的牌局`
    });

    // 设置导航栏标题
    wx.setNavigationBarTitle({ title: '排行榜' });
  },

  /**
   * 计算排行榜数据
   */
  calculateRankings(session) {
    const participants = session.participants.slice();
    if (session.taiSwitch) {
      participants.push('台');
    }
    
    const multiplier = session.multiplier || 1;

    // 计算原始累计分数（不乘倍率）
    const originalScores = {};
    participants.forEach(name => {
      originalScores[name] = 0;
    });
    
    // 累加每一局的分数
    if (session.rounds && session.rounds.length > 0) {
      session.rounds.forEach(round => {
        Object.keys(round.scores).forEach(name => {
          if (originalScores.hasOwnProperty(name)) {
            originalScores[name] += (round.scores[name] || 0);
          }
        });
      });
    }

    // 生成排行榜数据
    const rankings = participants.map(name => {
      const originalScore = originalScores[name] || 0;
      const finalScore = Math.round(originalScore * multiplier);
      
      return {
        name,
        originalScore, // 原始分数
        multiplier, // 倍率
        finalScore, // 倍率后总分
        avatar: this.generateAvatar(name),
        color: this.getPlayerColor(name)
      };
    });

    // 按倍率后总分降序排序
    rankings.sort((a, b) => b.finalScore - a.finalScore);

    return rankings;
  },

  /**
   * 生成玩家头像
   */
  generateAvatar(name) {
    if (name === '台') {
      return '台';
    }
    return name.charAt(0);
  },

  /**
   * 获取玩家颜色
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
    
    // 根据名字生成一个稳定的颜色索引
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  },

  /**
   * 分享排行榜
   */
  shareRanking() {
    const sessionInfo = this.data.sessionInfo;
    const rankings = this.data.rankings;
    if (!sessionInfo || rankings.length === 0) return;

    const date = new Date(sessionInfo.createdAt);
    const dateStr = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    let shareText = `🎮 麻将总分排行榜 🎮\n`;
    shareText += `📅 ${dateStr} ${timeStr}\n`;
    shareText += `🎯 共${sessionInfo.rounds ? sessionInfo.rounds.length : 0}局 | ${sessionInfo.multiplier}倍率\n`;
    shareText += `\n📊 最终排名:\n`;
    
    rankings.forEach((rank, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}️⃣`;
      const originalScore = rank.originalScore >= 0 ? `+${rank.originalScore}` : rank.originalScore.toString();
      const finalScore = rank.finalScore >= 0 ? `+${rank.finalScore}` : rank.finalScore.toString();
      const padding = '    '; // 用于对齐
      shareText += `${medal} ${rank.name}${padding}${originalScore} ×${rank.multiplier} = ${finalScore}分\n`;
    });
    
    shareText += `\n🔥 来自麻将计分小程序`;

    // 显示分享选项
    wx.showActionSheet({
      itemList: ['复制到剪贴板', '发送给朋友'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 复制到剪贴板
          wx.setClipboardData({
            data: shareText,
            success: () => {
              wx.showToast({ title: '排行榜已复制', icon: 'success' });
            }
          });
        } else if (res.tapIndex === 1) {
          // 发送给朋友 (微信分享)
          wx.shareAppMessage({
            title: '麻将总分排行榜',
            path: `/pages/ranking/ranking?sessionId=${sessionInfo.id}`,
            success: () => {
              wx.showToast({ title: '分享成功', icon: 'success' });
            }
          });
        }
      }
    });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  }
});
