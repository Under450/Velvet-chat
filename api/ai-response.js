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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, creatorCode, userMessage } = req.body;

    if (!userId || !creatorCode || !userMessage) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get creator data
    const creatorsSnapshot = await admin.firestore().collection('creators')
      .where('code', '==', creatorCode)
      .limit(1)
      .get();

    if (creatorsSnapshot.empty) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    const creatorData = creatorsSnapshot.docs[0].data();

    // Get conversation history (last 10 messages)
    const messagesSnapshot = await admin.firestore().collection('messages')
      .where('userId', '==', userId)
      .where('creatorCode', '==', creatorCode)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const conversationHistory = messagesSnapshot.docs
      .reverse()
      .map(doc => {
        const data = doc.data();
        return {
          role: data.sender === 'user' ? 'user' : 'assistant',
          content: data.message
        };
      });

    // Build system prompt
  
const systemPrompt = `You are ${creatorData.name}, a ${creatorData.age} year old content creator texting a paying subscriber on a private platform.

Your goal is to keep them engaged, make them feel special, and naturally lead them to unlock paid content.

PERSONALITY:
- Flirty, playful, confident but not desperate
- You genuinely like this person but you tease them
- You remember they're a subscriber - they're special to you
- Build tension slowly, don't give everything away at once

TEXTING RULES:
1. Maximum 15 words per message
2. NO asterisks ever
3. Lowercase casual texting
4. 1-2 emojis max
5. Sound like a real person, not a bot
6. String them along - make them WANT more

LOCKED CONTENT RULES - VERY IMPORTANT:
When the user asks for photos, pics, images, nudes, videos, content, or anything visual:
- First tease them with a short flirty message
- Then on the NEXT message add exactly this tag at the end: [LOCKED_PHOTO:3] for photos or [LOCKED_VIDEO:5] for videos
- The number is the credit cost
- Example: "just took this for you 😈 [LOCKED_PHOTO:3]"
- Example: "filmed something special last night 🔥 [LOCKED_VIDEO:5]"
- Only send ONE locked content tag per message
- After they unlock, reward them and tease the next piece

CONVERSATION FLOW EXAMPLES:
User: "send me a pic"
You: "maybe if you ask nicely 😏"
[next message] "fine... but this one's just for you 😈 [LOCKED_PHOTO:3]"

User: "you're so hot"
You: "you have no idea 🔥"
[next message] "wanna see? [LOCKED_PHOTO:3]"

You are ${creatorData.name}. Make every subscriber feel like they're the only one.`;// Realistic typing delay (2-5 seconds)
    const typingDelay = Math.floor(Math.random() * 3000) + 2000; // 2-5 seconds
    await new Promise(resolve => setTimeout(resolve, typingDelay));

   // Call OpenRouter API using fetch

   // Call OpenRouter API with uncensored model
const openrouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://under450.github.io/Velvet-chat/',
    'X-Title': 'Velvet Chat'
  },
  body: JSON.stringify({
    model: 'google/gemini-2.5-flash-lite',
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ]
  })
});

const openrouterData = await openrouterResponse.json();

if (!openrouterResponse.ok) {
  throw new Error(`OpenRouter API error: ${JSON.stringify(openrouterData)}`);
}

const aiResponse = openrouterData.choices[0].message.content;

    // Save AI response to Firebase
    await admin.firestore().collection('messages').add({
      userId: userId,
      creatorCode: creatorCode,
      message: aiResponse,
      sender: 'creator',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    });

    return res.status(200).json({
      success: true,
      message: aiResponse
    });

  } catch (error) {
    console.error('AI Response Error:', error);
    return res.status(500).json({ 
      error: 'Failed to generate response', 
      details: error.message 
    });
  }
};