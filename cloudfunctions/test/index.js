/**
 * 测试云函数 - 用于验证云开发环境是否正常
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  console.log('测试云函数被调用:', event);
  
  return {
    success: true,
    message: '云开发环境正常',
    timestamp: new Date().toISOString(),
    event: event
  };
};


