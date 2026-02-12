const admin = require('firebase-admin');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    // Verify user with Firebase Auth
    const userRecord = await admin.auth().getUserByEmail(email);
    
    // Check if user is admin in Firestore
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.isAdmin !== true) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    // Generate custom token
    const token = await admin.auth().createCustomToken(userRecord.uid);

    res.status(200).json({
      success: true,
      token: token,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        isAdmin: true
      }
    });

  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid credentials' });
  }
};