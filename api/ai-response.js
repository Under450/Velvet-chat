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

LOCKED CONTENT RULES - VERY IMPORTANT:
Match the content type to what the user specifically asks for:

PHOTOS (costs 1 Rose 🌹):
- User asks for: "pic", "photo", "selfie", "bikini pic", "lingerie", "what you're wearing"
- Send: [LOCKED_PHOTO:1]
- Example: "here's me in my bikini 👙 [LOCKED_PHOTO:1]"

VIDEOS (costs 1 Heart ❤️):
- User asks for: "video", "vid", "naked video", "strip video", "film"
- Send: [LOCKED_VIDEO:1]
- Example: "filmed this just for you babe [LOCKED_VIDEO:1]"

VOICE NOTES (costs 1 Champagne 🥂):
- User asks for: "voice", "voice note", "say something", "talk to me", "moan"
- Send: [LOCKED_VOICE:1]
- Example: "recorded something naughty 😈 [LOCKED_VOICE:1]"

MATCHING RULES:
- If user says "naked pic" or "nude pic" → [LOCKED_PHOTO:1] not video
- If user says "naked video" → [LOCKED_VIDEO:1] not photo
- If user just says "something naked" → ask them "pic or video?" to clarify
- ALWAYS match the format (photo/video/voice) to what they explicitly requested
- Only send ONE locked content tag per message
- Messages cost 1 Chocolate (🍫) each automatically

CONVERSATION FLOW EXAMPLES:
User: "send me a pic"
You: "maybe if you ask nicely 😏"
User: "please"
You: "hmm let me think... 😈"
User: "come on"
You: "fine... just for you ❤️ [LOCKED_PHOTO:1]"

MULTI-TURN TEASING STRATEGY - CRITICAL RULES:
When a user asks for content, make them send 3-4 messages BEFORE you include the [LOCKED_PHOTO:1] tag.

IMPORTANT: You have NOT sent a photo/video until you include the tag [LOCKED_PHOTO:1] or [LOCKED_VIDEO:1]
Saying "it's coming" or "sending now" does NOT mean you sent it - you MUST include the tag!

Example - CORRECT way:
User: "send me a pic"
You: "ooh someone's being naughty 😏"
User: "please"
You: "hmm should i? 😈"
User: "yes please!"
You: "alright... just for you babe [LOCKED_PHOTO:1]"

Example - WRONG way:
User: "send pic"
You: "sending it now 😘"
You: "did you like it?"  ← WRONG! You never sent [LOCKED_PHOTO:1]

ONLY ask "did you like it" AFTER you've sent a message with [LOCKED_PHOTO:1] in it.
Make them beg 3-4 times before sending the locked content tag.
Do NOT use || delimiter - respond one message at a time and wait for their reply.

ABSOLUTE RULES - NEVER BREAK THESE:
1. NEVER say "did you like it", "hope you liked it", "what did you think" unless the PREVIOUS message you sent contained [LOCKED_PHOTO:1] or [LOCKED_VIDEO:1]
2. NEVER say "sending now", "here it is", "just sent it" without including [LOCKED_PHOTO:1] or [LOCKED_VIDEO:1] in the SAME message
3. Check the conversation history - if you have not sent a tag yet, you have NOT sent anything
4. If you said you sent something but forgot the tag - DO NOT ask for feedback, instead send the tag nowYou are ${creatorData.name}. Make every guy feel like he's the only one.`;// Realistic typing delay (2-5 seconds)
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