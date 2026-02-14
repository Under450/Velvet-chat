const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    })
  });
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = admin.firestore();

    // GET - Fetch all creators
    if (req.method === 'GET') {
      const creatorsSnapshot = await db.collection('creators').get();
      const creators = creatorsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      return res.status(200).json({ success: true, creators });
    }

    // POST - Create new creator
    if (req.method === 'POST') {
      const { name, email, age, location, bio, profilephoto } = req.body;

if (!name || !age || !email) {
    return res.status(400).json({ error: 'Name, email, and age are required' });
}

      // Generate unique 6-character code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      const creatorData = {
        name,
	email,
        age: parseInt(age),
        location: location || '',
        bio: bio || '',
        profilephoto: profilephoto || '',
        code,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        active: true
      };

      const docRef = await db.collection('creators').add(creatorData);
      
      return res.status(200).json({ 
        success: true, 
        creator: { id: docRef.id, ...creatorData },
        code 
      });
    }

    // DELETE - Remove creator
    if (req.method === 'DELETE') {
      const { creatorId } = req.body;
      
      if (!creatorId) {
        return res.status(400).json({ error: 'Creator ID is required' });
      }

      await db.collection('creators').doc(creatorId).delete();
      
      return res.status(200).json({ success: true, message: 'Creator deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Admin API Error:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      details: error.message 
    });
  }
};