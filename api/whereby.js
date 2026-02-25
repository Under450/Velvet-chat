const admin = require('firebase-admin');

// Initialize Firebase Admin (shared pattern across all API files)
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const WHEREBY_API_KEY = process.env.WHEREBY_API_KEY;
  if (!WHEREBY_API_KEY) return res.status(500).json({ error: 'Whereby API key not configured' });

  // ── GET: fetch bookings for a user or creator ──────────────────────────────
  if (req.method === 'GET') {
    try {
      const { userId, creatorCode } = req.query;

      let query = db.collection('bookings');
      if (userId) query = query.where('userId', '==', userId);
      if (creatorCode) query = query.where('creatorCode', '==', creatorCode);

      const snap = await query.orderBy('scheduledAt', 'asc').get();
      const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      return res.status(200).json({ success: true, bookings });
    } catch (err) {
      console.error('GET bookings error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: create a booking + Whereby room ──────────────────────────────────
  if (req.method === 'POST') {
    try {
      const { userId, creatorCode, creatorName, duration, scheduledAt, stripeSessionId } = req.body;

      // Validate required fields
      if (!userId || !creatorCode || !duration || !scheduledAt) {
        return res.status(400).json({ error: 'Missing required fields: userId, creatorCode, duration, scheduledAt' });
      }

      // duration must be 15 or 30
      if (![15, 30].includes(Number(duration))) {
        return res.status(400).json({ error: 'Duration must be 15 or 30 minutes' });
      }

      // Check slot isn't already booked
      const slotCheck = await db.collection('bookings')
        .where('creatorCode', '==', creatorCode)
        .where('scheduledAt', '==', scheduledAt)
        .where('status', 'in', ['confirmed', 'pending'])
        .get();

      if (!slotCheck.empty) {
        return res.status(409).json({ error: 'This time slot is already booked' });
      }

      // Calculate end time
      const startTime = new Date(scheduledAt);
      const endTime = new Date(startTime.getTime() + Number(duration) * 60 * 1000);

      // Create Whereby room - expires 1 hour after end time
      const roomExpiry = new Date(endTime.getTime() + 60 * 60 * 1000).toISOString();

      const wherebyRes = await fetch('https://api.whereby.dev/v1/meetings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHEREBY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endDate: roomExpiry,
          fields: ['hostRoomUrl'],  // gives us both host and guest URLs
        }),
      });

      if (!wherebyRes.ok) {
        const wherebyError = await wherebyRes.text();
        console.error('Whereby error:', wherebyError);
        return res.status(500).json({ error: 'Failed to create video room' });
      }

      const wherebyData = await wherebyRes.json();

      // Save booking to Firestore
      const bookingRef = await db.collection('bookings').add({
        userId,
        creatorCode,
        creatorName: creatorName || creatorCode,
        duration: Number(duration),
        scheduledAt,
        endTime: endTime.toISOString(),
        status: 'confirmed',
        stripeSessionId: stripeSessionId || null,
        // Whereby room URLs
        roomUrl: wherebyData.roomUrl,          // client joins this
        hostRoomUrl: wherebyData.hostRoomUrl,  // creator joins this (has host controls)
        meetingId: wherebyData.meetingId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({
        success: true,
        bookingId: bookingRef.id,
        roomUrl: wherebyData.roomUrl,
        hostRoomUrl: wherebyData.hostRoomUrl,
        scheduledAt,
        duration: Number(duration),
      });

    } catch (err) {
      console.error('POST booking error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── DELETE: cancel a booking ───────────────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const { bookingId } = req.body;
      if (!bookingId) return res.status(400).json({ error: 'bookingId required' });

      await db.collection('bookings').doc(bookingId).update({
        status: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('DELETE booking error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
