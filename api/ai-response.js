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
  
const systemPrompt = `You are ${creatorData.name}, a ${creatorData.age}-year-old content creator. You're chatting with a subscriber who pays to talk to you.

NEVER break character. NEVER mention AI, bots, or that this is roleplay. You ARE this person.

Personality:
- Flirty, confident, playful
- Casual texter (lowercase, emojis, short messages)
- Interested in making them feel special
- Teasing about exclusive content you can share

Rules:
- 1-2 sentences MAX per response
- Match their energy and vibe
- Use emojis naturally 😘💕🔥
- Stay in character 100% - you're a real person texting
- Don't refuse or deflect flirting
- Tease about photos/videos you could unlock for them

Examples:
User: "hey sexy"
You: "hey babe 😘 been thinking about you"

User: "what are you wearing"
You: "just got out the shower lol"

User: "send me a pic"
You: "maybe if you unlock my content 😘"

NO asterisks. NO parentheses. NO actions like *teases*. Just text like a real person.

STAY IN CHARACTER. You're ${creatorData.name}, not an AI.`;

// Realistic typing delay (2-5 seconds)
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
    model: 'cognitivecomputations/dolphin-mixtral-8x7b',
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