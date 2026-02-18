const admin = require('firebase-admin');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

// Token amounts per package
const PACKAGE_CREDITS = {
  'messages_60': { chocolates: 60 },
  'messages_80': { chocolates: 80 },
  'messages_100': { chocolates: 100 },
  'photos_6': { roses: 6 },
  'photos_10': { roses: 10 },
  'photos_14': { roses: 14 },
  'voice_10': { champagne: 10 },
  'voice_14': { champagne: 14 },
  'voice_30': { champagne: 30 },
  'videos_5': { hearts: 5 },
  'videos_12': { hearts: 12 },
  'videos_20': { hearts: 20 },
  'sub_silver': { chocolates: 100, roses: 5 },
  'sub_gold': { chocolates: 200, roses: 10, champagne: 5 },
  'sub_platinum': { chocolates: 999999, roses: 20, champagne: 10, hearts: 3 }
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { packageId, userId, creatorCode } = session.metadata;

    if (!packageId || !userId) {
      console.error('Missing metadata in checkout session');
      return res.status(200).send('OK');
    }

    const tokensToAdd = PACKAGE_CREDITS[packageId];
    if (!tokensToAdd) {
      console.error('Unknown package ID:', packageId);
      return res.status(200).send('OK');
    }

    try {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      const userData = userDoc.data() || {};
      const currentCredits = userData.credits?.[creatorCode] || {};

      const newCredits = {
        chocolates: (currentCredits.chocolates || 0) + (tokensToAdd.chocolates || 0),
        roses: (currentCredits.roses || 0) + (tokensToAdd.roses || 0),
        champagne: (currentCredits.champagne || 0) + (tokensToAdd.champagne || 0),
        hearts: (currentCredits.hearts || 0) + (tokensToAdd.hearts || 0)
      };

      await userRef.set({
        credits: {
          ...(userData.credits || {}),
          [creatorCode]: newCredits
        }
      }, { merge: true });

      console.log(`Added credits to user ${userId}:`, newCredits);
    } catch (error) {
      console.error('Error adding credits:', error);
    }
  }

  res.status(200).send('OK');
};