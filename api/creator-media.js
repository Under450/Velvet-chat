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
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { creatorCode } = req.query;
  if (!creatorCode) return res.status(400).json({ error: 'creatorCode required' });

  // DELETE media
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id required' });
    await db.collection('media').doc(id).delete();
    return res.status(200).json({ success: true });
  }

  // GET all media for creator
  try {
    const snap = await db.collection('media').where('creatorCode', '==', creatorCode).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.status(200).json({ success: true, items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
