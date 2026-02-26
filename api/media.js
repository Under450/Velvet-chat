const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { creatorCode, userId, type, mode, id } = req.query;

  if (!creatorCode) return res.status(400).json({ error: 'Creator code required' });

  try {

    // MODE: potd - list or delete picture_of_day entries
    if (mode === 'potd') {
      if (req.method === 'DELETE') {
        if (!id) return res.status(400).json({ error: 'id required' });
        await db.collection('picture_of_day').doc(id).delete();
        return res.status(200).json({ success: true });
      }
      const snap = await db.collection('picture_of_day').where('creatorCode', '==', creatorCode).get();
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ success: true, entries });
    }

    // MODE: list - all media for creator dashboard
    if (mode === 'list') {
      if (req.method === 'DELETE') {
        if (!id) return res.status(400).json({ error: 'id required' });
        await db.collection('media').doc(id).delete();
        return res.status(200).json({ success: true });
      }
      const snap = await db.collection('media').where('creatorCode', '==', creatorCode).get();
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json({ success: true, items });
    }

    // DEFAULT: return random locked media for client chat
    let query = db.collection('media').where('creatorCode', '==', creatorCode);
    if (type) query = query.where('type', '==', type);

    const mediaSnapshot = await query.get();

    if (mediaSnapshot.empty) {
      return res.status(200).json({ available: false, message: 'No content available yet' });
    }

    let unlockedIds = [];
    if (userId) {
      const unlockedSnapshot = await db.collection('unlocked_media')
        .where('userId', '==', userId)
        .where('creatorCode', '==', creatorCode)
        .get();
      unlockedIds = unlockedSnapshot.docs.map(doc => doc.data().mediaId);
    }

    const allMedia = mediaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lockedMedia = allMedia.filter(m => !unlockedIds.includes(m.id));

    if (lockedMedia.length === 0) {
      const random = allMedia[Math.floor(Math.random() * allMedia.length)];
      return res.status(200).json({ available: true, media: random, alreadyUnlocked: true });
    }

    const random = lockedMedia[Math.floor(Math.random() * lockedMedia.length)];
    return res.status(200).json({ available: true, media: random, alreadyUnlocked: false });

  } catch (error) {
    console.error('Media API error:', error);
    return res.status(500).json({ error: error.message });
  }
};
