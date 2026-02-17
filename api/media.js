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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { creatorCode, userId, type } = req.query;

    if (!creatorCode) {
      return res.status(400).json({ error: 'Creator code required' });
    }

    // Get all media for this creator
    let query = db.collection('media').where('creatorCode', '==', creatorCode);
    if (type) query = query.where('type', '==', type);

    const mediaSnapshot = await query.get();

    if (mediaSnapshot.empty) {
      return res.status(200).json({ available: false, message: 'No content available yet' });
    }

    // Get already unlocked media for this user
    let unlockedIds = [];
    if (userId) {
      const unlockedSnapshot = await db.collection('unlocked_media')
        .where('userId', '==', userId)
        .where('creatorCode', '==', creatorCode)
        .get();
      unlockedIds = unlockedSnapshot.docs.map(doc => doc.data().mediaId);
    }

    // Find media not yet unlocked by this user
    const allMedia = mediaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const lockedMedia = allMedia.filter(m => !unlockedIds.includes(m.id));

    if (lockedMedia.length === 0) {
      // All media already unlocked - return a random one they already have
      const random = allMedia[Math.floor(Math.random() * allMedia.length)];
      return res.status(200).json({ available: true, media: random, alreadyUnlocked: true });
    }

    // Return a random locked media item
    const random = lockedMedia[Math.floor(Math.random() * lockedMedia.length)];
    return res.status(200).json({ available: true, media: random, alreadyUnlocked: false });

  } catch (error) {
    console.error('Media API error:', error);
    return res.status(500).json({ error: error.message });
  }
};