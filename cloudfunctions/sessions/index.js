const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, traceUser: true });

const db = cloud.database();
const coll = db.collection('sessions');
const now = () => db.serverDate();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, sid, token, participants, taiSwitch, meta } = event || {};
  
  console.log('[SESSIONS] function called with action:', action, 'openid:', OPENID);
  
  const getDoc = async (sid) => {
    if (!sid) return null;
    try {
      const r = await coll.doc(String(sid)).get();
      return r && r.data;
    } catch (e) { 
      console.log('[SESSIONS] getDoc error:', e);
      return null; 
    }
  };

  if (action === 'create') {
    console.log('[SESSIONS] create called with sid:', sid, 'token:', token);
    if (!sid || !token) return { ok: false, error: { code: 'BAD_PARAM', msg: 'sid/token required' } };
    
    const data = {
      sid: String(sid),
      token: String(token),
      ownerOpenId: OPENID,
      status: 'open',
      participants: participants || [],
      taiSwitch: taiSwitch || false,
      members: [OPENID],
      meta: meta || {},
      rounds: [],
      finalScores: null,
      multiplier: 1,
      updatedAt: now(),
      createdAt: now()
    };
    
    console.log('[SESSIONS] attempting to create session with data:', data);
    try {
      await coll.doc(String(sid)).set({ data });
      console.log('[SESSIONS] session created successfully');
      return { ok: true, sid, token };
    } catch (e) {
      console.error('[SESSIONS] failed to create session:', e);
      return { ok: false, error: { code: e.errCode || 'DB_SET_FAIL', msg: e.errMsg || String(e) } };
    }
  }

  if (action === 'get') {
    const doc = await getDoc(sid);
    if (!doc) return { ok: false, error: { code: 'NOT_FOUND', msg: 'session not found' } };
    return { 
      ok: true, 
      session: {
        sid: doc.sid,
        token: doc.token,
        status: doc.status,
        participants: doc.participants,
        taiSwitch: doc.taiSwitch,
        rounds: doc.rounds,
        finalScores: doc.finalScores,
        multiplier: doc.multiplier,
        meta: doc.meta || {}
      }
    };
  }

  if (action === 'join') {
    const doc = await getDoc(sid);
    if (!doc) return { ok: false, error: { code: 'NOT_FOUND', msg: '牌局不存在或已结束' } };
    if (doc.status !== 'open') return { ok: false, error: { code: 'ENDED', msg: '牌局已结束，无法加入' } };
    if (String(doc.token) !== String(token)) return { ok: false, error: { code: 'TOKEN_MISMATCH', msg: '邀请码不正确' } };
    
    // 检查是否已经加入
    const members = doc.members || [];
    if (members.includes(OPENID)) {
      return { ok: true, message: '已在牌局中', sessionId: sid };
    }
    
    // 检查人数限制
    const MAX_MEMBERS = 4;
    if (members.length >= MAX_MEMBERS) {
      return { ok: false, error: { code: 'FULL', msg: '牌局人数已满' } };
    }
    
    // 加入牌局
    await coll.doc(String(sid)).update({ 
      data: { 
        members: [...members, OPENID], 
        updatedAt: now() 
      } 
    });
    
    return { ok: true, message: '成功加入牌局', sessionId: sid };
  }

  if (action === 'finish') {
    const doc = await getDoc(sid);
    if (!doc) return { ok: false, error: { code: 'NOT_FOUND', msg: 'session not found' } };
    if (doc.ownerOpenId !== OPENID) return { ok: false, error: { code: 'FORBIDDEN', msg: '仅房主可结束' } };
    
    await coll.doc(String(sid)).update({ 
      data: { 
        status: 'finished', 
        updatedAt: now() 
      } 
    });
    
    return { ok: true };
  }

  return { ok: false, error: { code: 'BAD_ACTION', msg: `unknown action ${action}` } };
};
