const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, traceUser: true });
const db = cloud.database();
const coll = db.collection('sessions');
const now = () => db.serverDate();

// === 6位短码算法（与 tools/invite-code.js 的 toBase36_6 一致） ===
function toBase36_6(input='') {
  const s = String(input);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36).slice(-6).padStart(6, '0');
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, sid, token, meta, s, t } = event || {};
  
  console.log('[SESSION] function called with action:', action, 'openid:', OPENID);
  console.log('[SESSION] event:', event);

  const getDoc = async (sid) => {
    if (!sid) return null;
    try {
      const r = await coll.doc(String(sid)).get();
      return r && r.data;
    } catch (e) { return null; }
  };

  if (action === 'create') {
    console.log('[SESSION] create called with sid:', sid, 'token:', token, 'openid:', OPENID);
    if (!sid || !token) return { ok:false, error:{code:'BAD_PARAM', msg:'sid/token required'} };
    const data = {
      _id: String(sid),
      sid: String(sid),
      token: String(token),
      // 便于短码映射
      s6: toBase36_6(String(sid)),
      t6: toBase36_6(String(token)),
      ownerOpenId: OPENID,
      status: 'open',
      members: [OPENID], // 创建者自动加入参与者列表
      meta: meta || {},
      updatedAt: now(),
      createdAt: now()
    };
    console.log('[SESSION] attempting to create session with data:', data);
    try {
      // set 覆盖写，确保幂等；第一次创建也可
      await coll.doc(String(sid)).set({ data });
      console.log('[SESSION] session created successfully');
      return { ok:true, sid, token };
    } catch (e) {
      console.error('[SESSION] failed to create session:', e);
      return { ok:false, error:{code:e.errCode||'DB_SET_FAIL', msg:e.errMsg||String(e)} };
    }
  }

  // === 短码映射：6位 s/t -> 完整 sid/token ===
  if (action === 'lookupShort') {
    if (!s || !t) return { ok:false, error:{code:'BAD_PARAM', msg:'s/t required'} };
    try {
      const r = await coll.where({ s6: String(s), t6: String(t), status: 'open' }).limit(1).get();
      const doc = (r && r.data && r.data[0]) || null;
      if (!doc) return { ok:false, error:{code:'NOT_FOUND', msg:'session not found by short'} };
      return { ok:true, sid: doc.sid, token: doc.token };
    } catch (e) {
      return { ok:false, error:{code:'LOOKUP_FAIL', msg:String(e)} };
    }
  }

  if (action === 'get') {
    const doc = await getDoc(sid);
    if (!doc) return { ok:false, error:{code:'NOT_FOUND', msg:'session not found'} };
    return { 
      ok:true, 
      session:{ 
        sid:doc.sid, 
        token:doc.token, 
        status:doc.status, 
        meta:doc.meta||{}, 
        members:doc.members||[] 
      } 
    };
  }

  if (action === 'validate') {
    console.log('[SESSION] validate called with sid:', sid, 'token:', token);
    const doc = await getDoc(sid);
    console.log('[SESSION] found doc:', doc ? 'YES' : 'NO');
    if (doc) {
      console.log('[SESSION] doc.status:', doc.status, 'doc.token:', doc.token);
    }
    if (!doc) return { ok:false, error:{code:'NOT_FOUND', msg:'session not found'} };
    if (doc.status !== 'open') return { ok:false, error:{code:'ENDED', msg:'session ended'} };
    if (String(doc.token) !== String(token)) return { ok:false, error:{code:'TOKEN_MISMATCH', msg:'token mismatch'} };
    return { ok:true, session:{ sid:doc.sid, status:doc.status, ownerOpenId:doc.ownerOpenId } };
  }

  if (action === 'join') {
    const doc = await getDoc(sid);
    if (!doc) return { ok:false, error:{code:'NOT_FOUND', msg:'牌局不存在或已结束'} };
    if (doc.status !== 'open') return { ok:false, error:{code:'ENDED', msg:'牌局已结束，无法加入'} };
    if (String(doc.token) !== String(token)) return { ok:false, error:{code:'TOKEN_MISMATCH', msg:'邀请码不正确'} };
    
    // 检查是否已经加入
    const members = doc.members || [];
    if (members.includes(OPENID)) {
      return { ok:true, message:'已在牌局中', sessionId: sid };
    }
    
    // 检查人数限制（使用配置）
    const MAX_MEMBERS = 4; // 可以从环境变量或配置获取
    if (members.length >= MAX_MEMBERS) {
      return { ok:false, error:{code:'FULL', msg:'牌局人数已满'} };
    }
    
    // 加入牌局
    await coll.doc(String(sid)).update({ 
      data: { 
        members: [...members, OPENID], 
        updatedAt: now() 
      } 
    });
    
    return { ok:true, message:'成功加入牌局', sessionId: sid };
  }

  if (action === 'end') {
    const doc = await getDoc(sid);
    if (!doc) return { ok:false, error:{code:'NOT_FOUND', msg:'session not found'} };
    if (doc.ownerOpenId !== OPENID) return { ok:false, error:{code:'FORBIDDEN', msg:'仅房主可结束'} };
    await coll.doc(String(sid)).update({ data:{ status:'ended', updatedAt:now() } });
    return { ok:true };
  }

  if (action === 'debug_list') {
    console.log('[SESSION] debug_list action called');
    const { allowInit } = event || {};
    if (!allowInit) {
      return { ok:false, error:{code:'PERMISSION_DENIED', msg:'allowInit required'} };
    }
    try {
      console.log('[SESSION] attempting to query collection...');
      const docs = await coll.limit(10).get();
      console.log('[SESSION] query successful, found', docs.data.length, 'sessions');
      console.log('[SESSION] raw docs:', docs.data);
      return { ok:true, sessions: docs.data.map(d => ({ sid: d.sid, token: d.token, status: d.status, createdAt: d.createdAt })) };
    } catch (e) {
      console.error('[SESSION] debug_list error:', e);
      console.error('[SESSION] error details:', e.errCode, e.errMsg);
      
      // 如果集合不存在，尝试创建
      if (e.errCode === -502005) {
        console.log('[SESSION] collection not exists, trying to create...');
        try {
          // 创建一个临时文档来初始化集合
          await coll.add({
            data: {
              _temp: true,
              createdAt: now()
            }
          });
          console.log('[SESSION] collection created successfully');
          // 删除临时文档
          const tempDocs = await coll.where({ _temp: true }).get();
          if (tempDocs.data.length > 0) {
            await coll.doc(tempDocs.data[0]._id).remove();
          }
          return { ok:true, sessions: [], message: 'Collection created' };
        } catch (createError) {
          console.error('[SESSION] failed to create collection:', createError);
        }
      }
      
      return { ok:false, error:{code: e.errCode || 'DEBUG_FAIL', msg: e.errMsg || String(e)} };
    }
  }

  if (action === 'test') {
    console.log('[SESSION] test action called');
    return { ok: true, message: 'Cloud function is working!', openid: OPENID, timestamp: new Date().toISOString() };
  }

  return { ok:false, error:{code:'BAD_ACTION', msg:`unknown action ${action}`} };
};





