const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, traceUser: true });
const db = cloud.database();
const coll = db.collection('sessions');
const now = () => db.serverDate();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, sid, token, meta } = event || {};

  const getDoc = async (sid) => {
    if (!sid) return null;
    try {
      const r = await coll.doc(String(sid)).get();
      return r && r.data;
    } catch (e) { return null; }
  };

  if (action === 'create') {
    if (!sid || !token) return { ok:false, error:{code:'BAD_PARAM', msg:'sid/token required'} };
    const data = {
      _id: String(sid),
      sid: String(sid),
      token: String(token),
      ownerOpenId: OPENID,
      status: 'open',
      members: [OPENID], // 创建者自动加入参与者列表
      meta: meta || {},
      updatedAt: now(),
      createdAt: now()
    };
    try {
      // set 覆盖写，确保幂等；第一次创建也可
      await coll.doc(String(sid)).set({ data });
      return { ok:true, sid, token };
    } catch (e) {
      return { ok:false, error:{code:e.errCode||'DB_SET_FAIL', msg:e.errMsg||String(e)} };
    }
  }

  if (action === 'get') {
    const doc = await getDoc(sid);
    if (!doc) return { ok:false, error:{code:'NOT_FOUND', msg:'session not found'} };
    return { ok:true, session:{ sid:doc.sid, status:doc.status, meta:doc.meta||{} } };
  }

  if (action === 'validate') {
    const doc = await getDoc(sid);
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

  return { ok:false, error:{code:'BAD_ACTION', msg:`unknown action ${action}`} };
};





