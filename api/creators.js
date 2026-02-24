const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').split('\\n').join('\n')
    })
  });
}

const db = admin.firestore();

// Generate unique creator code
function generateCreatorCode(name) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars
  let random = '';
  for (let i = 0; i < 6; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${name.toUpperCase().replace(/\s/g, '')}-${random}`;
}
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET - List all creators
    if (req.method === 'GET') {
      const creatorsSnapshot = await db.collection('creators').get();
      const creators = [];
      
      creatorsSnapshot.forEach(doc => {
        creators.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return res.status(200).json({ creators });
    }

    // POST - Create new creator
    if (req.method === 'POST') {
      const { name, age, location, bio, boundaries } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const creatorCode = generateCreatorCode(name);

      const creatorData = {
        name,
        age: age || null,
        location: location || null,
        bio: bio || '',
        boundaries: boundaries || {},
        code: creatorCode,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        totalRevenue: 0,
        totalClients: 0
      };

      const docRef = await db.collection('creators').add(creatorData);

      return res.status(201).json({
        success: true,
        id: docRef.id,
        code: creatorCode,
        creator: creatorData
      });
    }

    // PUT - Update creator
    if (req.method === 'PUT') {
      const { id, ...updateData } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Creator ID is required' });
      }

      await db.collection('creators').doc(id).update(updateData);

      return res.status(200).json({ success: true, message: 'Creator updated' });
    }

    // DELETE - Delete creator
    if (req.method === 'DELETE') {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Creator ID is required' });
      }

      await db.collection('creators').doc(id).delete();

      return res.status(200).json({ success: true, message: 'Creator deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Creators API error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};