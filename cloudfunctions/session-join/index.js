const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, traceUser: true });
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { sid, token } = event || {};

  if (!sid || !token) {
    return { 
      ok: false, 
      reason: '缺少必要参数',
      code: 'MISSING_PARAMS' 
    };
  }

  try {
    // 获取会话信息
    const sessionDoc = await db.collection('sessions').doc(String(sid)).get();
    
    if (!sessionDoc.data) {
      return { 
        ok: false, 
        reason: '会话不存在或已过期',
        code: 'SESSION_NOT_FOUND' 
      };
    }

    const session = sessionDoc.data;

    // 检查会话状态
    if (session.status !== 'open') {
      return { 
        ok: false, 
        reason: '会话已关闭，无法加入',
        code: 'SESSION_CLOSED' 
      };
    }

    // 验证 token
    if (String(session.token) !== String(token)) {
      return { 
        ok: false, 
        reason: '邀请码无效',
        code: 'INVALID_TOKEN' 
      };
    }

    // 检查是否已经加入
    const members = session.members || [];
    if (members.includes(OPENID)) {
      return { 
        ok: true, 
        reason: '已在会话中',
        sessionId: sid 
      };
    }

    // 检查人数限制
    if (members.length >= 4) {
      return { 
        ok: false, 
        reason: '会话人数已满',
        code: 'SESSION_FULL' 
      };
    }

    // 加入会话
    await db.collection('sessions').doc(String(sid)).update({
      data: {
        members: db.command.push(OPENID),
        updatedAt: db.serverDate()
      }
    });

    return { 
      ok: true, 
      reason: '成功加入会话',
      sessionId: sid 
    };

  } catch (error) {
    console.error('[session-join] 加入会话失败:', error);
    return { 
      ok: false, 
      reason: '服务异常，请稍后重试',
      code: 'SERVER_ERROR' 
    };
  }
};
