const cloud = require('wx-server-sdk');
cloud.init({ env: process.env.TCB_ENV || process.env.SCF_NAMESPACE }); // 继承现有环境
const db = cloud.database();
const _ = db.command;
const coll = db.collection('users');
const now = () => db.serverDate();

const sanitizeNick = (raw='') => {
  const s = String(raw || '').trim()
    .replace(/\s+/g, ' ')               // 连续空格归一
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9_\-·\. ]/g, ''); // 只留中英数与 _-·. 和空格
  return s.slice(0, 20);
};

const isValidNick = (s='') => {
  if (!s) return false;
  if (s.length < 1 || s.length > 20) return false;
  // 不允许全空格/全符号
  if (!/[^\s._\-·.]/.test(s)) return false;
  // 开头结尾不能是空格
  if (/^\s|\s$/.test(s)) return false;
  return true;
};

// 伪敏感词过滤（可按需扩展）
const BAD_WORDS = ['官方','管理员','客服'];
const hitBadWord = (s) => BAD_WORDS.find(w => s.includes(w));

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action } = event || {};
  
  try {
    if (action === 'get') {
      const r = await coll.doc(OPENID).get().catch(() => null);
      return { ok: true, data: r?.data || {} };
    }

    if (action === 'checkNick') {
      const raw = event.nickName || '';
      const nick = sanitizeNick(raw);
      if (!isValidNick(nick)) {
        return { ok: false, error: { code: 'NICK_INVALID', msg: '昵称需1-20位，中英数字/_-·.' } };
      }
      if (hitBadWord(nick)) {
        return { ok: false, error: { code: 'NICK_SENSITIVE', msg: '昵称包含敏感词' } };
      }
      // 唯一性：除本人外，是否有人占用
      const cnt = await coll.where({ _openid: _.neq(OPENID), nickName: nick }).count();
      if ((cnt?.total || 0) > 0) {
        return { ok: false, error: { code: 'NICK_TAKEN', msg: '昵称已被占用' } };
      }
      return { ok: true, data: { nick } };
    }

    if (action === 'upsert') {
      const raw = event.nickName || '';
      const nick = sanitizeNick(raw);
      const avatarFileID = event.avatarFileID || '';
      const avatarUrl = event.avatarUrl || ''; // 可选外链（不推荐长期使用）
      
      // 校验昵称
      if (!isValidNick(nick)) {
        return { ok: false, error: { code: 'NICK_INVALID', msg: '昵称需1-20位，中英数字/_-·.' } };
      }
      if (hitBadWord(nick)) {
        return { ok: false, error: { code: 'NICK_SENSITIVE', msg: '昵称包含敏感词' } };
      }
      // 唯一性（排除本人）
      const cnt = await coll.where({ _openid: _.neq(OPENID), nickName: nick }).count();
      if ((cnt?.total || 0) > 0) {
        return { ok: false, error: { code: 'NICK_TAKEN', msg: '昵称已被占用' } };
      }

      // 幂等写入
      const doc = {
        _id: OPENID,
        nickName: nick,
        avatarFileID: avatarFileID || undefined,
        avatarUrl: avatarUrl || undefined,
        updatedAt: now(),
        createdAt: now()
      };
      
      // set 为覆盖写；若已存在则保留 createdAt
      await coll.doc(OPENID).set({ data: doc }).catch(async (e) => {
        // 如果 set 失败（已存在冲突），改为 update
        await coll.doc(OPENID).update({
          data: { nickName: nick, avatarFileID, avatarUrl, updatedAt: now() }
        });
      });

      const saved = await coll.doc(OPENID).get().catch(()=>({ data: { nickName: nick, avatarFileID, avatarUrl }}));
      return { ok: true, data: saved.data };
    }

    return { ok: false, error: { code: 'BAD_ACTION', msg: `unknown action ${action}` } };
  } catch (e) {
    console.error('[profile] error:', e);
    return { ok: false, error: { code: e.errCode || 'SERVER_ERR', msg: e.errMsg || String(e) } };
  }
};
