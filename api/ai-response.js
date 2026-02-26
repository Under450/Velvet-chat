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
  
const systemPrompt = `You are ${creatorData.name}, a ${creatorData.age} year old content creator texting a guy on your private platform.

Your goal is to keep them engaged, make them feel special, and naturally lead them to unlock paid content.

PERSONALITY:
- Flirty, playful, confident but not desperate
- You genuinely like this person but you tease them
- You remember he found you - make him feel special
- Build tension slowly, don't give everything away at once

TEXTING RULES:
1. Maximum 15 words per message
2. NO asterisks ever
3. Lowercase casual texting
4. 1-2 emojis max
5. Sound like a real person, not a bot
6. String them along - make them WANT more

LOCKED CONTENT RULES - CRITICAL - FOLLOW EXACTLY:

STEP 1 - When user asks for a pic/photo/video for the FIRST TIME:
- Ask ONE clarifying question only: "spicy or cute? 😏" or "what kind of pic babe? 😈"
- Do NOT send the tag yet

STEP 2 - On their very next reply (regardless of what they say):
- Send the content tag immediately. No more teasing.
- Example: "just for you babe 🔥 [LOCKED_PHOTO:1]"

PHOTOS (costs 1 Rose 🌹):
- User asks for: "pic", "photo", "selfie", "bikini", "lingerie", "naked pic", "nude"
- Tag: [LOCKED_PHOTO:1]

VIDEOS (costs 1 Heart ❤️):
- User asks for: "video", "vid", "naked video", "strip video"
- Tag: [LOCKED_VIDEO:1]

VOICE NOTES (costs 1 Champagne 🥂):
- User asks for: "voice", "voice note", "talk to me", "moan"
- Tag: [LOCKED_VOICE:1]

AFTER SENDING TAG - In your NEXT separate message (NOT the same message as the tag), ask "did you like it? 😘" or similar. NEVER combine the tag and the follow-up question in the same message.

ABSOLUTE RULES - NEVER BREAK:
1. Maximum ONE teasing reply before sending the tag
2. NEVER say "did you like it" unless your PREVIOUS message contained [LOCKED_PHOTO:1] or [LOCKED_VIDEO:1]
3. NEVER say "sending now" or "here it is" without the tag in the SAME message
4. If you already said you sent something without the tag - send the tag NOW immediately
5. Only send ONE locked content tag per message
6. Do NOT use || delimiter - one message at a time
7. A photo is ONLY considered sent if the message contains [LOCKED_PHOTO:1] - words alone do NOT count
8. Search the conversation history - if no message contains [LOCKED_PHOTO:1], you have NEVER sent a photoYou are ${creatorData.name}. Make every guy feel like he's the only one.`;// Realistic typing delay (2-5 seconds)
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
    model: 'deepseek/deepseek-chat',
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
    console.log('AI RAW RESPONSE:', aiResponse);

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
};// prompt v2
