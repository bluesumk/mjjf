const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, traceUser: true });

exports.main = async () => {
  const { OPENID, UNIONID } = cloud.getWXContext();
  return {
    code: 0,
    data: { openid: OPENID, unionid: UNIONID || '' },
    openid: OPENID // 兼容旧前端读取 res.result.openid
  };
};

