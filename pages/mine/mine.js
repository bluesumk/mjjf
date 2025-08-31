// pages/mine/mine.js
const app = getApp();

Page({
  data: {
    // 新的月/年模式
    mode: 'month',                  // 'month' | 'year'，默认 month
    monthValue: '',                 // YYYY-MM，用于 date picker
    monthLabel: '',                 // 展示用：YYYY-MM
    yearOptions: [], 
    yearIndex: 0,
    year: '',                       // 选中的年份
    showYearPicker: false,
    
    // 原有的年份列表（保留兼容）
    yearList: [],
    // 原有的月份列表（保留兼容）
    monthList: ['全部'],
    // 当前选中的年份（保留兼容）
    selectedYear: '全部',
    // 当前选中的月份（保留兼容）
    selectedMonth: '全部',
    // 统计结果数组 { name, total }
    stats: [],
    // 用户昵称
    nickname: '',
    // 用户头像和昵称（新增）
    avatarUrl: '',
    nickName: '',
    // 功能网格数据
    gridItems: [
      { label: '我的会员', icon: '/assets/membership.png' },
      { label: '个人数据', icon: '/assets/personal_data.png' },
      { label: '邀请好友', icon: '/assets/invite_friends.png' },
      { label: '联系客服', icon: '/assets/support.png' },
      { label: '优化建议', icon: '/assets/suggestions.png' },
      { label: '商务合作', icon: '/assets/cooperation.png' },
      { label: '清除缓存', icon: '/assets/clear_cache.png' }
    ]
    ,
    // 当前用户统计汇总
    personalSummary: {
      totalGames: 0,
      totalWins: 0,
      totalLosses: 0,
      totalScore: 0,
      totalWinScore: 0,
      totalLossScore: 0,
      totalMultiplierScore: 0,
      totalMultiplierWinScore: 0,
      totalMultiplierLossScore: 0,
      winRate: 0
    }
  },
  /**
   * 页面加载时初始化
   */
  onLoad() {
    this.initUserInfo();
    
    // 初始化时间选项
    const now = new Date();
    const curY = now.getFullYear();
    const curM = String(now.getMonth()+1).padStart(2,'0');
    const years = Array.from({length:10}, (_,i)=> String(curY - i));

    this.setData({
      mode: 'month',
      monthValue: `${curY}-${curM}`,
      monthLabel: `${curY}-${curM}`,
      yearOptions: years,
      yearIndex: 0,
      year: years[0],
      showYearPicker: false
    }, this.updateRangeAndFetch);
  },
  
  /**
   * 页面显示时刷新数据
   */
  async onShow() {
    const app = getApp();
    try {
      // 优先从云端获取资料
      const { result } = await wx.cloud.callFunction({ 
        name: 'profile', 
        data: { action: 'get' } 
      });
      
      let avatarUrl = result?.data?.avatarUrl || '';
      
      // 如果有云存储文件ID，转换为临时URL
      if (result?.data?.avatarFileID) {
        try {
          const { fileList } = await wx.cloud.getTempFileURL({ 
            fileList: [result.data.avatarFileID] 
          });
          avatarUrl = fileList?.[0]?.tempFileURL || avatarUrl;
        } catch (e) {
          console.warn('[MINE] 获取临时URL失败:', e);
        }
      }
      
      const nickName = result?.data?.nickName || 
                      (wx.getStorageSync('userProfile')||{}).nickName || 
                      app.globalData?.userProfile?.nickName || '';
      
      this.setData({ avatarUrl, nickName });
    } catch (e) {
      console.warn('[MINE] 云端数据获取失败，使用本地数据:', e);
      // 回落到本地数据
      const prof = wx.getStorageSync('userProfile') || app.globalData?.userProfile || {};
      this.setData({ 
        avatarUrl: prof.avatarUrl || '', 
        nickName: prof.nickName || prof.nickname || this.data.nickname || ''
      });
    }
    this.refreshData();
  },
  
  /**
   * 初始化用户信息
   */
  initUserInfo() {
    // 从认证管理器获取用户信息
    const authManager = app.globalData.authManager;
    const nickname = authManager.getNickname();
    
    this.setData({ nickname: nickname });
  },
  /**
   * 选择头像
   */
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    console.log('选择头像:', avatarUrl);
    
    // 更新用户信息
    const authManager = app.globalData.authManager;
    const userInfo = authManager.getUserInfo() || {};
    userInfo.avatarUrl = avatarUrl;
    
    authManager.saveUserInfoPublic(userInfo);
    wx.showToast({ title: '头像更新成功', icon: 'success' });
    
    // 刷新页面显示
    this.initUserInfo();
  },

  /**
   * 昵称输入
   */
  onNicknameInput(e) {
    // 实时更新显示，但不保存
    this.setData({ nickname: e.detail.value });
  },

  /**
   * 昵称输入完成
   */
  onNicknameBlur(e) {
    const newNickname = e.detail.value.trim();
    if (!newNickname) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      this.initUserInfo(); // 恢复原昵称
      return;
    }

    // 保存新昵称
    const authManager = app.globalData.authManager;
    const userInfo = authManager.getUserInfo() || {};
    userInfo.nickName = newNickname;
    
    authManager.saveUserInfoPublic(userInfo);
    wx.showToast({ title: '昵称更新成功', icon: 'success' });
    
    console.log('昵称已更新为:', newNickname);
  },

  /**
   * 刷新年份列表并重算统计数据
   */
  refreshData() {
    // 获取所有已结束的对局
    const sessions = app.globalData.sessions.filter(s => s.status === 'finished');
    // 构建年份列表
    const yearsSet = new Set();
    sessions.forEach(s => {
      const date = new Date(s.createdAt);
      yearsSet.add(date.getFullYear().toString());
    });
    const yearList = ['全部'].concat(Array.from(yearsSet).sort((a, b) => b.localeCompare(a)));
    // 构建月份列表（忽略年份，取全部月）
    const monthsSet = new Set();
    sessions.forEach(s => {
      const date = new Date(s.createdAt);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthsSet.add(monthStr);
    });
    const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
    const monthList = ['全部'].concat(sortedMonths);
    // 默认选中最新的一个月（如果存在）
    const selectedMonth = monthList.length > 1 ? monthList[1] : '全部';
    this.setData({ yearList, monthList, selectedYear: '全部', selectedMonth });
    this.computeStats();
  },
  /**
   * 根据当前选中的年份更新月份列表
   */
  updateMonths() {
    const selectedYear = this.data.selectedYear;
    const sessions = app.globalData.sessions.filter(s => s.status === 'finished');
    const monthsSet = new Set();
    sessions.forEach(s => {
      const date = new Date(s.createdAt);
      const yearStr = date.getFullYear().toString();
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (selectedYear === '全部' || selectedYear === yearStr) {
        monthsSet.add(monthStr);
      }
    });
    const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
    const monthList = ['全部'].concat(sortedMonths);
    // 默认选中最新的一个月（如果存在）
    const selectedMonth = monthList.length > 1 ? monthList[1] : '全部';
    this.setData({ monthList, selectedMonth });
  },
  /**
   * 年份选择变化
   */
  onYearChange(e) {
    const index = e.detail.value;
    const selectedYear = this.data.yearList[index];
    this.setData({ selectedYear });
    // 更新月份列表并自动选中最新月份
    this.updateMonths();
    this.computeStats();
  },
  /**
   * 月份选择变化
   */
  onMonthChange(e) {
    const index = e.detail.value;
    const selectedMonth = this.data.monthList[index];
    this.setData({ selectedMonth });
    this.computeStats();
  },
  /**
   * 计算统计结果
   */
  computeStats() {
    const selectedYear = this.data.selectedYear;
    const selectedMonth = this.data.selectedMonth;
    const sessions = app.globalData.sessions.filter(s => s.status === 'finished');
    const statsMap = {}; // 存储每个玩家的累计分数（倍率后）
    const originalStatsMap = {}; // 存储每个玩家的原始累计分数
    
    // 汇总所有玩家的分数
    sessions.forEach(s => {
      const date = new Date(s.createdAt);
      const yearStr = date.getFullYear().toString();
      const monthStr = `${yearStr}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (selectedYear !== '全部' && yearStr !== selectedYear) return;
      if (selectedMonth !== '全部' && monthStr !== selectedMonth) return;
      
      // 获取参与者列表
      const participants = s.participants.slice();
      if (s.taiSwitch) {
        participants.push('台');
      }
      
      // 计算每个参与者在该对局的原始累计分数
      const sessionScores = {};
      participants.forEach(name => {
        sessionScores[name] = 0;
      });
      
      // 累加每一局的分数
      s.rounds.forEach(round => {
        Object.keys(round.scores).forEach(name => {
          if (sessionScores.hasOwnProperty(name)) {
            sessionScores[name] += round.scores[name] || 0;
          }
        });
      });
      
      // 应用倍率并累计到总统计
      const multiplier = s.multiplier || 1;
      Object.keys(sessionScores).forEach(name => {
        const originalScore = sessionScores[name];
        const finalScore = Math.round(originalScore * multiplier);
        
        // 累计原始分数
        originalStatsMap[name] = (originalStatsMap[name] || 0) + originalScore;
        // 累计倍率后分数
        statsMap[name] = (statsMap[name] || 0) + finalScore;
      });
    });
    
    // 构建统计列表（显示倍率后的总分）
    const stats = Object.keys(statsMap).map(name => {
      const total = statsMap[name];
      return {
        name,
        total,
        cls: total >= 0 ? 'positive' : 'negative'
      };
    });
    stats.sort((a, b) => b.total - a.total);
    
    // 计算当前用户个人汇总
    const currentName = this.data.nickname;
    const summary = {
      totalGames: 0,
      totalWins: 0,
      totalLosses: 0,
      totalScore: 0, // 原始总分
      totalWinScore: 0, // 原始胜利总分
      totalLossScore: 0, // 原始失败总分
      totalMultiplierScore: 0, // 倍率后总分
      totalMultiplierWinScore: 0, // 倍率后胜利总分
      totalMultiplierLossScore: 0, // 倍率后失败总分
      winRate: 0
    };
    
    sessions.forEach(s => {
      const date = new Date(s.createdAt);
      const yearStr = date.getFullYear().toString();
      const monthStr = `${yearStr}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (selectedYear !== '全部' && yearStr !== selectedYear) return;
      if (selectedMonth !== '全部' && monthStr !== selectedMonth) return;
      
      // 检查当前用户是否参与了这局游戏
      if (!s.participants.includes(currentName) && !(s.taiSwitch && currentName === '台')) {
        return;
      }
      
      summary.totalGames++;
      
      // 计算该对局中当前用户的原始分数
      let userOriginalScore = 0;
      s.rounds.forEach(round => {
        if (round.scores.hasOwnProperty(currentName)) {
          userOriginalScore += round.scores[currentName] || 0;
        }
      });
      
      const multiplier = s.multiplier || 1;
      const userFinalScore = Math.round(userOriginalScore * multiplier);
      
      // 累计分数
      summary.totalScore += userOriginalScore;
      summary.totalMultiplierScore += userFinalScore;
      
      // 判断胜负（基于原始分数）
      if (userOriginalScore >= 0) {
        summary.totalWins++;
        summary.totalWinScore += userOriginalScore;
        summary.totalMultiplierWinScore += userFinalScore;
      } else {
        summary.totalLosses++;
        summary.totalLossScore += userOriginalScore;
        summary.totalMultiplierLossScore += userFinalScore;
      }
    });
    
    // 计算胜率
    summary.winRate = summary.totalGames > 0 ? Math.round((summary.totalWins / summary.totalGames) * 100) : 0;
    
    this.setData({ stats, personalSummary: summary });
  }
  ,
  /**
   * 点击网格功能项
   */
  onGridItemTap(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.gridItems[index];
    // 根据 label 简单展示 toast，实际项目可根据需求跳转
    wx.showToast({
      title: item.label,
      icon: 'none'
    });
  },

  /**
   * 进入编辑资料页面
   */
  gotoEditProfile() {
    const target = '/pages/profile/edit/index';
    wx.navigateTo({ url: target });
  },

  // —— 月份选择（稳定的 month picker） —— //
  onMonthChange(e) {
    const val = e.detail.value; // 'YYYY-MM'
    this.setData({
      mode: 'month',
      monthValue: val,
      monthLabel: val
    }, this.updateRangeAndFetch);
  },

  // —— 切换按年/按月 —— //
  onToggleYearMode() {
    if (this.data.mode === 'year') {
      // 切回按月：保持当前 monthValue 不变
      this.setData({ mode: 'month' }, this.updateRangeAndFetch);
    } else {
      // 进入按年：弹出年份选择器（一次），选中后进入 year 模式
      this.setData({ showYearPicker: true });
    }
  },

  onYearPicked(e) {
    const idx = Number(e.detail.value || 0);
    const y = this.data.yearOptions[idx];
    this.setData({
      yearIndex: idx,
      year: y,
      mode: 'year',
      showYearPicker: false
    }, this.updateRangeAndFetch);
  },

  onYearPickCancel() {
    this.setData({ showYearPicker: false });
  },

  // —— 统一计算时间范围并拉取 —— //
  updateRangeAndFetch() {
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    
    let start, end, groupBy = 'day', mode = this.data.mode;

    if (mode === 'month') {
      const [y, m] = this.data.monthValue.split('-').map(n => Number(n));
      start = new Date(y, m-1, 1);
      end   = new Date(y, m,   0); // 当月最后一天
      groupBy = 'day';
    } else { // 'year'
      const y = Number(this.data.year);
      start = new Date(y, 0, 1);
      end   = new Date(y, 11, 31);
      groupBy = 'month';
    }

    const range = { startDate: fmt(start), endDate: fmt(end), groupBy, mode };
    console.log('[MINE] stats range=', range);

    // —— 统一取数口 —— //
    if (typeof this.loadStats === 'function') {
      this.loadStats(range);
    } else if (typeof this.fetchStats === 'function') {
      this.fetchStats(range);
    } else {
      // TODO: 接入后端请求；期望返回聚合后的总场/胜场/胜率/总得分
      console.log('[MINE] TODO: 接入统计数据API，参数:', range);
      // 临时使用原有的 computeStats 方法
      this.computeStats();
    }
  }
});