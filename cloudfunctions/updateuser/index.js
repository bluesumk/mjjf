const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, traceUser: true });
const db = cloud.database();

exports.main = async (event, ctx) => {
  const { OPENID } = cloud.getWXContext();
  console.log('[UPDATEUSER] function called, openid:', OPENID);
  
  if (!OPENID) return { ok: false, message: 'Missing openid' };

  try {
    const { nickName, avatarFileID, avatarUrl } = event.userInfo || {};
    
    if (!nickName && !avatarFileID && !avatarUrl) {
      return { ok: false, message: 'No user info provided' };
    }

    const coll = db.collection('users');
    const now = db.serverDate();
    
    // 构建用户数据，使用 openId 作为文档 ID
    const userData = {
      nickName: nickName || '',
      avatarFileID: avatarFileID || '',
      avatarUrl: avatarUrl || '',
      updatedAt: now
    };

    console.log('[UPDATEUSER] saving user data:', userData);

    // 直接使用 set 操作，简单高效
    await coll.doc(OPENID).set({ 
      data: {
        ...userData,
        createdAt: now // set 会保留 createdAt 如果已存在
      }
    });
    
    console.log('[UPDATEUSER] user data saved successfully');
    return { ok: true };
    
  } catch (err) {
    console.error('[UPDATEUSER] operation failed:', err);
    return { 
      ok: false, 
      message: 'Update failed: ' + (err.errMsg || err.message || String(err))
    };
  }
};

