// pages/records/records.js
const app = getApp();

Page({
  data: {
    // 当前选中的 tab：ongoing（进行中）或 finished（已结束）
    activeTab: 'ongoing',
    // 年份选择列表
    yearList: [],
    // 当前选中的年份
    selectedYear: '全部',
    // 月份选择列表
    monthList: [],
    // 当前选中的月份
    selectedMonth: '全部',
    // 时间选择器数据
    timePickerRange: [[], []],
    timePickerValue: [0, 0],
    // 显示的对局
    displayedSessions: [],
    // 选择器显示文案
    pickerLabel: '选择月份'
  },
  /**
   * 页面显示时刷新数据
   */
  onShow() {
    this.refreshData();
  },
  /**
   * 刷新年份月份列表并筛选对局
   */
  refreshData() {
    const sessions = app.globalData.sessions;
    
    const yearsSet = new Set();
    const monthsSet = new Set();
    
    sessions.forEach(s => {
      const date = new Date(s.createdAt);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthStr = `${String(month).padStart(2, '0')}月`;
      yearsSet.add(year.toString());
      monthsSet.add(monthStr);
    });
    
    const sortedYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    const yearList = ['全部', ...sortedYears];
    
    const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
    const monthList = ['全部', ...sortedMonths];
    
    // 默认选中最新的年份和月份
    const selectedYear = yearList.length > 1 ? yearList[1] : '全部';
    const selectedMonth = monthList.length > 1 ? monthList[1] : '全部';
    
    // 设置时间选择器数据
    const timePickerRange = [yearList, monthList];
    const timePickerValue = [
      yearList.indexOf(selectedYear),
      monthList.indexOf(selectedMonth)
    ];
    
    // 计算选择器显示文案
    const pickerLabel = this.calculatePickerLabel(selectedYear, selectedMonth);
    
    this.setData({ 
      yearList, 
      monthList, 
      selectedYear, 
      selectedMonth,
      timePickerRange,
      timePickerValue,
      pickerLabel
    });
    this.filterSessions();
  },
  /**
   * 根据当前 tab 和月份筛选对局
   */
  filterSessions() {
    const { activeTab, selectedYear, selectedMonth } = this.data;
    const filtered = app.globalData.sessions.filter(s => {
      if (activeTab === 'ongoing' && s.status !== 'ongoing') return false;
      if (activeTab === 'finished' && s.status !== 'finished') return false;
      
      const date = new Date(s.createdAt);
      const year = date.getFullYear().toString();
      const month = date.getMonth() + 1;
      const monthStr = `${String(month).padStart(2, '0')}月`;
      
      if (selectedYear && selectedYear !== '全部') {
        if (year !== selectedYear) return false;
      }
      if (selectedMonth && selectedMonth !== '全部') {
        if (monthStr !== selectedMonth) return false;
      }
      return true;
    });
    // 按时间倒序排序
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    // 将数据转换为展示所需格式
    const displayedSessions = filtered.map(s => {
      const date = new Date(s.createdAt);
      const displayDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate()
        .toString()
        .padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes()
        .toString()
        .padStart(2, '0')}`;
      // 构建原始分数列表（已结束的对局显示原始累计分数）
      let finalList = [];
      if (s.status === 'finished') {
        // 计算原始累计分数
        const names = s.participants.slice();
        if (s.taiSwitch) {
          names.push('台');
        }
        
        // 计算每个玩家的原始累计分数
        const originalScores = {};
        names.forEach(name => {
          originalScores[name] = 0;
        });
        
        // 累加每一局的分数
        if (s.rounds && s.rounds.length > 0) {
          s.rounds.forEach(round => {
            Object.keys(round.scores).forEach(name => {
              if (originalScores.hasOwnProperty(name)) {
                originalScores[name] += round.scores[name] || 0;
              }
            });
          });
        }
        
        finalList = names.map(name => {
          const score = originalScores[name] || 0;
          return {
            name,
            score,
            cls: score >= 0 ? 'positive' : 'negative',
            avatarColor: this.getPlayerColor(name)
          };
        });
      }
      // 为进行中的对局添加详细时间信息和参与者列表
      let startDateText = '';
      let startTimeText = '';
      let participantsList = [];
      
      if (s.status === 'ongoing') {
        const startDate = new Date(s.createdAt);
        startDateText = `${startDate.getFullYear()}年${startDate.getMonth() + 1}月${startDate.getDate()}日`;
        startTimeText = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
        
        // 计算进行中对局的累计分数
        const names = s.participants.slice();
        if (s.taiSwitch) {
          names.push('台');
        }
        
        // 计算每个玩家的累计分数
        const currentScores = {};
        names.forEach(name => {
          currentScores[name] = 0;
        });
        
        // 累加每一局的分数
        s.rounds.forEach(round => {
          Object.keys(round.scores).forEach(name => {
            if (currentScores.hasOwnProperty(name)) {
              currentScores[name] += round.scores[name] || 0;
            }
          });
        });
        
        participantsList = names.map(name => ({
          name,
          score: currentScores[name] || 0,
          avatarColor: this.getPlayerColor(name)
        }));
      }

      return {
        id: s.id,
        displayDate,
        participants: s.participants,
        participantsList,
        status: s.status,
        roundsCount: s.rounds.length,
        finalList,
        tai: s.taiSwitch || false,
        startDateText,
        startTimeText,
        multiplier: s.multiplier
      };
    });
    this.setData({ displayedSessions });
  },
  /**
   * 切换顶部的进行中/已结束 tab
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.filterSessions();
  },
  /**
   * 时间选择器变化
   */
  onTimeChange(e) {
    const timePickerValue = e.detail.value;
    const selectedYear = this.data.yearList[timePickerValue[0]];
    const selectedMonth = this.data.monthList[timePickerValue[1]];
    
    // 更新选择器显示文案
    const pickerLabel = this.calculatePickerLabel(selectedYear, selectedMonth);
    
    this.setData({ 
      selectedYear, 
      selectedMonth, 
      timePickerValue,
      pickerLabel
    });
    this.filterSessions();
  },

  /**
   * 计算选择器显示文案
   */
  calculatePickerLabel(selectedYear, selectedMonth) {
    if (selectedYear === '全部' && selectedMonth === '全部') {
      return '选择月份';
    } else if (selectedYear === '全部') {
      return `全部年份 - ${selectedMonth}`;
    } else if (selectedMonth === '全部') {
      return `${selectedYear}年 - 全部月份`;
    } else {
      return `${selectedYear}年 - ${selectedMonth}`;
    }
  },

  /**
   * 月份选择器变化
   */
  onMonthChange(e) {
    const selectedMonth = this.data.monthList[e.detail.value];
    this.setData({ selectedMonth });
    this.filterSessions();
  }
  ,
  /**
   * 删除指定的对局
   */
  deleteSession(e) {
    const id = Number(e.currentTarget.dataset.id);
    
    // 确认删除
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个对局记录吗？删除后不可恢复。',
      confirmText: '删除',
      confirmColor: '#e54d42',
      success: (res) => {
        if (res.confirm) {
          const sessions = app.globalData.sessions;
          const idx = sessions.findIndex(s => s.id === id);
          if (idx !== -1) {
            sessions.splice(idx, 1);
            // 更新存储
            app.saveSessions();
            // 刷新页面数据
            this.refreshData();
            wx.showToast({
              title: '删除成功',
              icon: 'success',
              duration: 1500
            });
          } else {
            wx.showToast({
              title: '删除失败',
              icon: 'error',
              duration: 1500
            });
          }
        }
      }
    });
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
  }
  ,
  /**
   * 点击对局卡片，进入继续记分或查看详情
   */
  onSessionTap(e) {
    const id = Number(e.currentTarget.dataset.id);
    const status = e.currentTarget.dataset.status;
    if (!id) return;
    if (status === 'ongoing') {
      // 进行中的对局，设置当前会话 ID 并跳转至计分页面继续记分
      app.globalData.currentSessionId = id;
      wx.navigateTo({ url: '/pages/scoring/scoring' });
    } else {
      // 已结束的对局，跳转至牌局明细页面查看每局详情
      wx.navigateTo({
        url: `/pages/rounds-detail/index?sessionId=${id}`
      });
    }
  }
});