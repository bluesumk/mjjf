// pages/scoring/scoring.js
const app = getApp();
const config = require('../../config.js');

Page({
  data: {
    // 当前对局 ID
    sessionId: null,
    // 参与者列表
    participants: [],
    // 是否启用台板抽佣
    hasTai: false,
    // 当前阶段：input（录入中）、summary（一局完成）、final（收盘完成）
    stage: 'input',
    // 当前输入的分数数组，对应每个参与者
    scores: [],
    // 每位参与者的胜负标记（'win' 或 'lose'）
    roles: [],
    // 当前分数和
    scoreSum: 0,
    // 是否存在空值
    hasEmpty: true,
    // 总共第几局
    roundNumber: 1,
    // 单局汇总分，用于 summary 阶段显示
    summaryScores: [],
    summaryClasses: [],
    // 最终总分
    finalList: null,
    // 收盘倍数输入弹窗
    showMultiplierInput: false,
    multiplierInput: '',
    // 当前聚焦的输入框索引
    focusedInput: -1
  },
  /**
   * 页面加载
   */
  onLoad(options) {
    // 优先使用URL参数中的sessionId，然后使用全局的currentSessionId
    const sessionId = options.sessionId || app.globalData.currentSessionId;
    this.setData({ sessionId });
    
    // 如果有sessionId参数，更新全局currentSessionId
    if (options.sessionId) {
      app.globalData.currentSessionId = options.sessionId;
    }
    
    const session = app.globalData.sessions.find(s => s.id === sessionId);
    if (session) {
      let participants = session.participants.slice();
      const hasTai = !!session.taiSwitch;
      
      // 如果启用台版，将"台"作为参与者加入计分（但不一定在最后）
      if (hasTai && !participants.includes('台')) {
        participants.push('台');
      }
      
      // 初始化得分和胜负标记，默认全部标记为输，台版标记为空
      const scores = new Array(participants.length).fill('');
      const roles = new Array(participants.length).fill('lose');
      
      // 台版不参与胜负，设置为空字符串
      if (hasTai) {
        const taiIndex = participants.findIndex(p => p === '台');
        if (taiIndex !== -1) {
          roles[taiIndex] = '';
        }
      }
      this.setData({
        participants,
        hasTai,
        scores,
        roles
      });
      this.updateRoundNumber();
    }
  },

  /**
   * 胜负切换处理 - 新的按钮式交互
   * @param {*} e 事件
   */
  onRoleToggle(e) {
    const index = Number(e.currentTarget.dataset.index);
    const role = e.currentTarget.dataset.role;
    const roles = this.data.roles.slice();
    const scores = this.data.scores.slice();
    const participants = this.data.participants;
    
    // 切换角色
    if (roles[index] === role) {
      roles[index] = ''; // 取消选择
      scores[index] = 0;  // 重置分数为0
    } else {
      roles[index] = role; // 选择新角色
      // 根据角色设置分数的正负号
      const currentScore = Math.abs(parseFloat(scores[index]) || 0);
      if (role === 'win') {
        scores[index] = currentScore > 0 ? currentScore : 1;
      } else if (role === 'lose') {
        scores[index] = currentScore > 0 ? -currentScore : -1;
      }
    }
    
    // 重新计算平衡
    this.calculateAndBalance(scores, roles);
  },

  /**
   * 旧的胜负切换处理 - 保持兼容性
   * @param {*} e 事件
   */
  onRoleChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    const value = e.detail.value;
    const roles = this.data.roles.slice();
    roles[index] = value;
    // 更新
    this.setData({ roles });
  },
  /**
   * 更新当前是第几局
   */
  updateRoundNumber() {
    const session = app.globalData.sessions.find(s => s.id === this.data.sessionId);
    if (session) {
      this.setData({
        roundNumber: session.rounds.length + 1
      });
    }
  },
  /**
   * 分数输入处理
   */
  onScoreInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    let value = parseFloat(e.detail.value) || 0;
    const participants = this.data.participants;
    const hasTai = this.data.hasTai;
    const scores = this.data.scores.slice();
    const roles = this.data.roles.slice();
    
    // 更新分数
    scores[index] = value;
    
    // 根据分数自动设置胜负状态
    if (participants[index] !== '台') {
      if (value > 0) {
        roles[index] = 'win';
      } else if (value < 0) {
        roles[index] = 'lose';
      } else {
        roles[index] = '';
      }
    }
    
    // 计算总和并检查是否需要自动补平
    this.calculateAndBalance(scores, roles);
  },

  /**
   * 台版分数输入处理
   */
  onTaiScoreInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    let value = parseFloat(e.detail.value) || 0;
    
    // 台版只允许0分及以上
    if (value < 0) {
      value = 0;
      wx.showToast({ title: '台版只能输入0分及以上', icon: 'none' });
    }
    
    const scores = this.data.scores.slice();
    const roles = this.data.roles.slice();
    
    scores[index] = value;
    
    // 计算总和并检查是否需要自动补平
    this.calculateAndBalance(scores, roles);
  },

  /**
   * 计算总和并自动平衡分数
   */
  calculateAndBalance(scores, roles) {
    const participants = this.data.participants;
    const hasTai = this.data.hasTai;
    
    // 计算前n-1个人的总和
    let inputSum = 0;
    let hasEmpty = false;
    
    // 只计算前n-1个人的分数，最后一个人自动补平
    for (let i = 0; i < participants.length - 1; i++) {
      const score = parseFloat(scores[i]);
      if (isNaN(score) || scores[i] === '' || scores[i] === null || scores[i] === undefined) {
        hasEmpty = true;
        scores[i] = 0; // 将空值设为0以便计算
      } else {
        scores[i] = score;
      }
      inputSum += scores[i];
    }
    
    // 自动计算最后一个人的分数，使总和为0
    const lastIndex = participants.length - 1;
    const autoScore = -inputSum;
    
    // 如果最后一个人是台版，且需要负分，则提示并重置
    if (participants[lastIndex] === '台' && autoScore < 0) {
      wx.showToast({ title: '当前分数会让台版为负分，请调整', icon: 'none' });
      // 可以选择重置台版分数为0，或者不更新
      scores[lastIndex] = 0;
    } else {
      scores[lastIndex] = autoScore;
      
      // 根据最后一个人的分数设置胜负状态（如果不是台版）
      if (participants[lastIndex] !== '台') {
        if (autoScore > 0) {
          roles[lastIndex] = 'win';
        } else if (autoScore < 0) {
          roles[lastIndex] = 'lose';
        } else {
          roles[lastIndex] = '';
        }
      }
    }
    
    // 重新计算总和
    let totalSum = 0;
    for (let i = 0; i < scores.length; i++) {
      totalSum += parseFloat(scores[i]) || 0;
    }
    
    this.setData({
      scores,
      roles,
      scoreSum: totalSum,
      hasEmpty
    });
  },

  /**
   * 重置当前输入
   */
  cancelInput() {
    const scores = new Array(this.data.participants.length).fill('');
    const roles = new Array(this.data.participants.length).fill('lose');
    this.setData({
      scores,
      scoreSum: 0,
      hasEmpty: true
      ,
      roles
    });
  },
  /**
   * 确认并保存本局记分
   */
  confirmScores() {
    const hasEmpty = this.data.hasEmpty;
    const scores = this.data.scores;
    const participants = this.data.participants;
    const sessionId = this.data.sessionId;
    const roles = this.data.roles;
    const hasTai = this.data.hasTai;
    // 检查是否有未填写
    if (hasEmpty) {
      wx.showToast({ title: '请完整输入得分', icon: 'none' });
      return;
    }
    // 检查至少选择一名赢家
    const winCount = roles.filter(r => r === 'win').length;
    if (winCount === 0) {
      wx.showToast({ title: '请选择赢家', icon: 'none' });
      return;
    }
    // 计算本局结果
    const session = app.globalData.sessions.find(s => s.id === sessionId);
    if (!session) return;
    const roundResult = {};
    const parsedScores = scores.map(s => parseFloat(s) || 0);
    
    // 直接使用输入的分数，不做额外调整
    participants.forEach((name, idx) => {
      roundResult[name] = parsedScores[idx];
    });
    session.rounds.push({ scores: roundResult });
    // 更新全局保存
    app.saveSessions();
    // 构建单局展示分数（所有参与者包括台）
    const summaryScores = participants.map((name, idx) => roundResult[name]);
    const summaryClasses = summaryScores.map(n => n >= 0 ? 'positive' : 'negative');
    this.setData({
      summaryScores,
      summaryClasses,
      stage: 'summary'
    });
    this.updateRoundNumber();
  },
  /**
   * 开始下一局记分
   */
  startNextRound() {
    const participants = this.data.participants;
    this.setData({
      scores: new Array(participants.length).fill(''),
      scoreSum: 0,
      hasEmpty: true,
      stage: 'input',
      summaryScores: []
    });
    this.updateRoundNumber();
  },
  /**
   * 打开收盘倍率输入窗口
   */
  openMultiplierInput() {
    this.setData({ showMultiplierInput: true, multiplierInput: '' });
  },
  /**
   * 倍率输入
   */
  handleMultiplierInput(e) {
    this.setData({ multiplierInput: e.detail.value });
  },
  /**
   * 取消收盘
   */
  cancelMultiplier() {
    this.setData({ showMultiplierInput: false });
  },
  /**
   * 确认收盘并计算最终成绩
   */
  confirmMultiplier() {
    let m = parseInt(this.data.multiplierInput);
    if (isNaN(m) || m === 0) {
      m = 1;
    }
    this.finalizeSession(m);
    this.setData({ showMultiplierInput: false });
  },
  /**
   * 计算最终成绩并更新对局状态
   */
  finalizeSession(multiplier) {
    const sessionId = this.data.sessionId;
    const session = app.globalData.sessions.find(s => s.id === sessionId);
    if (!session) return;
    session.multiplier = multiplier;
    // 累计各人分数
    const totals = {};
    // 初始化玩家和台板得分
    session.participants.forEach(name => {
      totals[name] = 0;
    });
    if (session.taiSwitch) {
      totals['台'] = 0;
    }
    // 累计每局
    session.rounds.forEach(round => {
      Object.keys(round.scores).forEach(name => {
        totals[name] = (totals[name] || 0) + round.scores[name];
      });
    });
    // 应用倍率
    Object.keys(totals).forEach(name => {
      totals[name] = totals[name] * multiplier;
    });
    session.finalScores = totals;
    session.status = 'finished';
    session.multiplier = multiplier;
    app.saveSessions();
    // 构建最终列表用于渲染，包括台板，按分数排序
    const names = session.participants.slice();
    if (session.taiSwitch) {
      names.push('台');
    }
    
    const finalList = names.map(name => {
      const sc = totals[name];
      return {
        name,
        score: sc,
        cls: sc >= 0 ? 'positive' : 'negative'
      };
    }).sort((a, b) => b.score - a.score); // 按分数从高到低排序

    this.setData({
      finalList,
      stage: 'final'
    });
  },
  /**
   * 返回首页
   */
  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  /**
   * 页面显示时开启分享
   */
  onShow() {
    // 开启分享功能
    wx.showShareMenu({ 
      withShareTicket: true, 
      menus: config.share.menus 
    });
  },

  /**
   * 分享当前牌局
   */
  onShareAppMessage() {
    const { sessionId } = this.data;
    
    if (!sessionId) {
      return {
        title: config.share.defaultTitle,
        path: config.pages.index,
        imageUrl: config.share.defaultImageUrl
      };
    }

    // 获取当前会话的邀请token
    const sessions = app.globalData.sessions || [];
    const currentSession = sessions.find(s => s.id === sessionId);
    const inviteToken = currentSession?.inviteToken || sessionId;

    return {
      title: `一起来玩麻将计分吧！房间号：${inviteToken.toString().toUpperCase()}`,
      path: `${config.pages.sessionJoin}?sid=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(inviteToken)}`,
      imageUrl: config.share.defaultImageUrl
    };
  }
});