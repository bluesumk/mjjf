// pages/mine/mine.js
const app = getApp();
const config = require('../../config.js');

Page({
  data: {
    // 统一时间范围对象
    statsRange: { startDate: '', endDate: '', mode: 'month', groupBy: 'day' },
    loadingCore: false,
    loadingDetail: false,
    
    // 新的月/年模式
    mode: 'month',                  // 'month' | 'year'
    monthValue: '',                 // YYYY-MM
    monthLabel: '',
    yearOptions: [], 
    yearIndex: 0,
    year: '', 
    yearLabel: '',                  // 新增：显示在年份胶囊中的文案
    
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
    __profileReady: false,  // 用于首屏判断（不影响 UI）
    // 新增：用户信息
    user: null,
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
      yearLabel: years[0]
    }, this.updateRangeAndFetch);
  },
  
  /**
   * 页面显示时刷新数据
   */
  async onShow() { 
    this.hydrate(); 
    try {
      const { result } = await wx.cloud.callFunction({ 
        name: 'profile', 
        data: { action: 'get' } 
      });
      const prof = result?.data || {};
      let avatarUrl = prof.avatarUrl || '';
      if (prof.avatarFileID) {
        const { fileList } = await wx.cloud.getTempFileURL({ fileList: [prof.avatarFileID] });
        avatarUrl = fileList?.[0]?.tempFileURL || avatarUrl;
      }
      this.setData({ avatarUrl, nickName: prof.nickName || '', __profileReady: true });
      wx.setStorageSync('userProfile', { avatarUrl, nickName: prof.nickName || '' });
      getApp().globalData.userProfile = { avatarUrl, nickName: prof.nickName || '' };
    } catch(e) {
      const cache = wx.getStorageSync('userProfile') || {};
      this.setData({ avatarUrl: cache.avatarUrl || '', nickName: cache.nickName || '', __profileReady: true });
    }
    this.refreshData();
  },

  hydrate() {
    const u = (function(){ try { return wx.getStorageSync('user') || null; } catch (e) { return null; } })();
    this.setData({ user: u });
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
  computeStats(range) {
    // 优先使用传入的range，回落到旧的selectedYear/selectedMonth
    let selectedYear, selectedMonth;
    if (range && range.startDate && range.endDate) {
      // 从range解析年月用于兼容旧逻辑
      const startDate = new Date(range.startDate);
      const endDate = new Date(range.endDate);
      selectedYear = startDate.getFullYear().toString();
      selectedMonth = range.mode === 'year' ? '全部' : 
                     `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    } else {
      selectedYear = this.data.selectedYear;
      selectedMonth = this.data.selectedMonth;
    }
    const sessions = app.globalData.sessions.filter(s => s.status === 'finished');
    const statsMap = {}; // 存储每个玩家的累计分数（倍率后）
    const originalStatsMap = {}; // 存储每个玩家的原始累计分数
    
    // 汇总所有玩家的分数
    sessions.forEach(s => {
      const date = new Date(s.createdAt);
      
      // 优先使用range的时间范围进行过滤
      if (range && range.startDate && range.endDate) {
        const sessionDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (sessionDate < range.startDate || sessionDate > range.endDate) return;
      } else {
        // 回落到旧的年月过滤逻辑
        const yearStr = date.getFullYear().toString();
        const monthStr = `${yearStr}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (selectedYear !== '全部' && yearStr !== selectedYear) return;
        if (selectedMonth !== '全部' && monthStr !== selectedMonth) return;
      }
      
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
      
      // 优先使用range的时间范围进行过滤
      if (range && range.startDate && range.endDate) {
        const sessionDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (sessionDate < range.startDate || sessionDate > range.endDate) return;
      } else {
        // 回落到旧的年月过滤逻辑
        const yearStr = date.getFullYear().toString();
        const monthStr = `${yearStr}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (selectedYear !== '全部' && yearStr !== selectedYear) return;
        if (selectedMonth !== '全部' && monthStr !== selectedMonth) return;
      }
      
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
   * 处理同步微信资料（优化版）
   */
  async handleSync() {
    try {
      const updatedUser = await app.getUserProfileAndSave();
      this.setData({ user: updatedUser });
      wx.showToast({ 
        title: '同步成功', 
        icon: 'success',
        duration: 1500 
      });
    } catch (error) {
      console.warn('[sync] 同步失败:', error);
      
      let errorMsg = '同步失败';
      if (error.errMsg && error.errMsg.includes('auth deny')) {
        errorMsg = '用户拒绝授权';
      } else if (error.message && error.message.includes('getUserProfile')) {
        errorMsg = '微信版本过低';
      }
      
      wx.showToast({ 
        icon: 'none', 
        title: errorMsg,
        duration: 2000
      });
    }
  },

  /**
   * 一键同步微信资料（保留原有方法）
   */
  async syncWeChatProfile() {
    if (!wx.getUserProfile) { wx.showToast({ title:'微信版本过低', icon:'none' }); return; }
    const res = await wx.getUserProfile({ desc:'用于完善资料' });
    const nick = res.userInfo?.nickName || '';
    const avatar = res.userInfo?.avatarUrl || '';
    const up = await wx.cloud.callFunction({
      name:'profile',
      data:{ action:'upsert', nickName:nick, avatarUrl:avatar }
    });
    let avatarUrl = avatar;
    const data = up?.result?.data || {};
    if (data.avatarFileID) {
      const r = await wx.cloud.getTempFileURL({ fileList:[data.avatarFileID] });
      avatarUrl = r.fileList?.[0]?.tempFileURL || avatar;
    }
    this.setData({ nickName:nick, avatarUrl });
    wx.setStorageSync('userProfile', { nickName:nick, avatarUrl });
    getApp().globalData.userProfile = { nickName:nick, avatarUrl };
    wx.showToast({ title:'已同步', icon:'success' });
  },

  /**
   * 进入编辑资料页面
   */
  gotoEditProfile() {
    const target = '/pages/profile/edit/index';
    wx.navigateTo({ url: target });
  },

  // 月份选择
  onMonthChange(e) {
    const val = e.detail.value; // 'YYYY-MM'
    this.setData({ 
      mode: 'month', 
      monthValue: val, 
      monthLabel: val 
    }, this.updateRangeAndFetch);
  },

  // 选择年份 -> 进入 year 模式
  onYearPicked(e) {
    const idx = Number(e.detail.value || 0);
    const year = this.data.yearOptions[idx];
    // 进入 year 模式并更新胶囊文案
    this.setData({ 
      mode: 'year', 
      yearIndex: idx, 
      year, 
      yearLabel: year 
    }, this.updateRangeAndFetch);
  },

  // 返回按月模式（保持当前 monthValue 不变）
  backToMonth() {
    if (this.data.mode !== 'month') {
      this.setData({ mode: 'month' }, this.updateRangeAndFetch);
    }
  },

  // 统一计算时间范围并取数（自然月/自然年；含起止日）
  updateRangeAndFetch() {
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let start, end, groupBy = 'day';

    if (this.data.mode === 'month') {
      const [y, m] = this.data.monthValue.split('-').map(Number);
      start = new Date(y, m-1, 1);
      end   = new Date(y, m,   0);
      groupBy = 'day';
    } else {
      const y = Number(this.data.year);
      start = new Date(y, 0, 1);
      end   = new Date(y, 11, 31);
      groupBy = 'month';
    }

    const range = { startDate: fmt(start), endDate: fmt(end), groupBy, mode: this.data.mode };
    this.setData({ statsRange: range });
    this.refreshAll(range); // 新增统一刷新入口
  },

  // 新增统一刷新入口
  async refreshAll(range) {
    // 去抖：避免连续切换导致并发
    if (this._refreshing) return; 
    this._refreshing = true;
    const done = () => { this._refreshing = false; };

    try {
      this.setData({ loadingCore: true, loadingDetail: true });

      // 1) 核心数据
      if (typeof this.loadStats === 'function') {
        await this.loadStats(range);
      } else if (typeof this.fetchStats === 'function') {
        // 兼容旧接口（若返回 summary/detail 均有，顺手灌入）
        const res = await this.fetchStats(range);
        if (res && res.summary) this.setData({ personalSummary: res.summary });
        if (res && res.detail) this.setData({ stats: res.detail });
      } else if (typeof this.computeStats === 'function') {
        await this.computeStats(range);
      }

      // 2) 详细统计（若有独立方法就再调一次；否则认为由上一步已返回）
      if (typeof this.loadDetail === 'function') {
        await this.loadDetail(range);
      } else if (typeof this.fetchDetail === 'function') {
        const det = await this.fetchDetail(range);
        if (det) this.setData({ detailStats: det });
      }

      // 统一日志
      console.log('[LINK] core & detail refreshed with range =', range);
      console.log('[LINK] coreSummary=', this.data.personalSummary);
      console.log('[LINK] detailStats=', this.data.stats);
    } catch (e) {
      console.warn('[LINK] refreshAll error', e);
    } finally {
      this.setData({ loadingCore: false, loadingDetail: false });
      done();
    }
  }
});