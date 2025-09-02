const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, traceUser: true });
const db = cloud.database();
const _ = db.command;

const MAX_SEATS = 4;
function isValidRoomId(roomId) {
  return typeof roomId === 'string' && roomId.length > 0 && roomId.length <= 64;
}

exports.main = async (event, ctx) => {
  const { OPENID } = cloud.getWXContext();
  const roomId = event && event.roomId;
  if (!OPENID) return { code: 40000, message: 'NO_OPENID' };
  if (!isValidRoomId(roomId)) return { code: 40001, message: 'ROOM_ID_REQUIRED' };

  const trx = await db.startTransaction();
  try {
    const roomRef = trx.collection('rooms').doc(String(roomId));
    const snap = await roomRef.get().catch(() => null);
    if (!snap || !snap.data) {
      await trx.rollback(); return { code: 40401, message: 'ROOM_NOT_FOUND' };
    }

    const room = snap.data;
    if (room.status === 'closed') {
      await trx.rollback(); return { code: 40902, message: 'ROOM_CLOSED' };
    }

    const members = Array.isArray(room.members) ? room.members.slice() : [];
    if (members.includes(OPENID)) {
      await trx.commit(); return { code: 0, data: { roomId } }; // 已在房间内
    }
    if (members.length >= MAX_SEATS) {
      await trx.rollback(); return { code: 40901, message: 'ROOM_FULL' };
    }

    members.push(OPENID);
    await roomRef.update({ data: { members, updatedAt: Date.now() } });
    await trx.commit();
    return { code: 0, data: { roomId } };
  } catch (err) {
    try { await trx.rollback(); } catch(e) {}
    return { code: 50000, message: 'JOIN_FAILED', details: String(err && err.message || err) };
  }
};

