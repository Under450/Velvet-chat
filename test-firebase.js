require('dotenv').config();
const admin = require('firebase-admin');

console.log('Testing Firebase connection...');
console.log('Project ID:', process.env.FIREBASE_PROJECT_ID);
console.log('Client Email:', process.env.FIREBASE_CLIENT_EMAIL);
console.log('Private Key exists:', !!process.env.FIREBASE_PRIVATE_KEY);
console.log('Private Key starts with:', process.env.FIREBASE_PRIVATE_KEY?.substring(0, 50));

try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
  
  console.log('✅ Firebase initialized successfully!');
  
  const db = admin.firestore();
  console.log('✅ Firestore connected!');
  
} catch (error) {
  console.log('❌ Firebase error:', error.message);
}