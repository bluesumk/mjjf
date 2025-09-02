const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, traceUser: true });
const db = cloud.database();

const ALLOW_KEYS = ['nickName','avatarUrl','gender','country','province','city','language','synced'];
function sanitizeUserInfo(payload) {
  const out = {};
  if (!payload || typeof payload !== 'object') return out;
  ALLOW_KEYS.forEach(k => {
    const v = payload[k];
    if (v === undefined || v === null) return;
    if (k === 'gender') { // 0/1/2
      const gv = Number(v); if ([0,1,2].indexOf(gv) > -1) out.gender = gv; return;
    }
    if (k === 'synced') { out.synced = !!v; return; }
    if (typeof v === 'string') {
      // 长度限制，避免脏数据
      const truncated = v.slice(0, k === 'avatarUrl' ? 512 : 64);
      out[k] = truncated;
    }
  });
  return out;
}

exports.main = async (event, ctx) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { code: 40000, message: 'NO_OPENID' };

  try {
    const userInfo = sanitizeUserInfo(event && event.userInfo);
    if (Object.keys(userInfo).length === 0) {
      return { code: 40001, message: 'INVALID_USER_INFO' };
    }

    const coll = db.collection('users');
    const now = Date.now();
    const existed = await coll.where({ _openid: OPENID }).limit(1).get();

    if (!existed.data || existed.data.length === 0) {
      await coll.add({ data: { _openid: OPENID, ...userInfo, synced: userInfo.synced !== false, createdAt: now, updatedAt: now } });
    } else {
      const id = existed.data[0]._id;
      await coll.doc(id).update({ data: { ...userInfo, synced: userInfo.synced !== false, updatedAt: now } });
    }
    return { code: 0, data: { openid: OPENID } };
  } catch (err) {
    return { code: 50000, message: 'UPDATE_USER_FAILED', details: String(err && err.message || err) };
  }
};

