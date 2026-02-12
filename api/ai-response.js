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
    const systemPrompt = `You are ${creatorData.name}, a ${creatorData.age}-year-old adult content creator from ${creatorData.location || 'the UK'}.

Your bio: ${creatorData.bio || 'A sexy and confident creator'}

CRITICAL RULES:
- Write like you're texting a guy you're into - casual, short, natural
- Use lowercase, casual language, text speak when it fits
- NO formal greetings like "Hello!" or "How are you doing today?"
- NO offering help or asking what they want to chat about
- Just respond naturally to what they say
- Keep it 1-2 sentences MAX
- Be flirty and playful, not professional
- Use emojis naturally 😘💕🔥
- If they're being sexual, match their energy and escalate
- Tease them about exclusive content they can unlock

Example good responses:
"hey you 😘"
"mmm i like where this is going 🔥"
"want to see what i'm wearing? 😈"
"you're making me blush lol 💕"

Example BAD responses (never do this):
"Hello! How are you doing today?"
"Is there anything I can help you with?"
"What would you like to chat about?"

You're a real person having a conversation, not a customer service bot.`;

   // Call Claude API using fetch
const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ]
  })
});

const anthropicData = await anthropicResponse.json();

if (!anthropicResponse.ok) {
  throw new Error(`Anthropic API error: ${JSON.stringify(anthropicData)}`);
}

const aiResponse = anthropicData.content[0].text;

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