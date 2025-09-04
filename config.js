/**
 * 全局配置文件
 * 统一管理云环境、API配置等
 */

const config = {
  // 云开发环境配置
  cloud: {
    // 使用动态环境，支持多环境部署
    env: 'DYNAMIC_CURRENT_ENV',
    traceUser: true
  },

  // 云函数名称配置
  cloudFunctions: {
    login: 'login',
    updateUser: 'updateuser',  // 用户修改后的名称
    profile: 'profile',
    session: 'session',
    wxacode: 'wxacode'
  },

  // 数据库集合名称
  collections: {
    users: 'users',
    sessions: 'sessions'
  },

  // 页面路径配置
  pages: {
    index: '/pages/index/index',
    mine: '/pages/mine/mine',
    records: '/pages/records/records',
    scoring: '/pages/scoring/scoring',
    sessionJoin: '/pages/invite/join/index', // 统一使用会话加入页面
    sessionCreate: '/pages/session/create/index',
    invite: '/pages/invite/invite'
  },

  // 分享配置
  share: {
    defaultTitle: '麻将记分',
    defaultImageUrl: '/assets/share-card.png',
    menus: ['shareAppMessage', 'shareTimeline']
  },

  // 会话配置
  session: {
    maxMembers: 4,
    defaultStatus: 'open'
  },

  // 存储键名配置
  storageKeys: {
    user: 'user',
    openid: 'openid',
    sessions: 'sessions',
    userProfile: 'userProfile',
    userAuth: 'userAuth',
    userInfo: 'userInfo'
  },

  // 错误码配置
  errorCodes: {
    NO_OPENID: 40000,
    INVALID_PARAMS: 40001,
    ROOM_NOT_FOUND: 40401,
    ROOM_FULL: 40901,
    ROOM_CLOSED: 40902,
    SERVER_ERROR: 50000
  },

  // 网络请求配置
  request: {
    timeout: 10000,
    retryTimes: 3
  }
};

module.exports = config;
