const admin = require('firebase-admin');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: get available slots for a creator ─────────────────────────────────
  // Returns slots for the next 14 days, excluding already-booked ones
  if (req.method === 'GET') {
    try {
      const { creatorCode } = req.query;
      if (!creatorCode) return res.status(400).json({ error: 'creatorCode required' });

      // Get creator's availability settings
      const availDoc = await db.collection('availability').doc(creatorCode).get();
      if (!availDoc.exists) {
        return res.status(200).json({ success: true, slots: [], message: 'No availability set' });
      }

      const availData = availDoc.data();
      // availData.slots is array of { dayOfWeek: 0-6, hour: 0-23, minute: 0|30 }
      const weeklySlots = availData.slots || [];

      // Get existing bookings for next 14 days to exclude booked slots
      const now = new Date();
      const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const bookingsSnap = await db.collection('bookings')
        .where('creatorCode', '==', creatorCode)
        .where('scheduledAt', '>=', now.toISOString())
        .where('scheduledAt', '<=', twoWeeksOut.toISOString())
        .where('status', 'in', ['confirmed', 'pending'])
        .get();

      const bookedSlots = new Set(bookingsSnap.docs.map(d => d.data().scheduledAt));

      // Generate available slots for next 14 days
      const availableSlots = [];
      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const date = new Date(now);
        date.setDate(date.getDate() + dayOffset);
        date.setHours(0, 0, 0, 0);

        const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

        const daySlots = weeklySlots.filter(s => s.dayOfWeek === dayOfWeek);
        for (const slot of daySlots) {
          const slotDate = new Date(date);
          slotDate.setHours(slot.hour, slot.minute || 0, 0, 0);

          // Skip slots in the past or within 1 hour
          if (slotDate.getTime() < now.getTime() + 60 * 60 * 1000) continue;

          const isoString = slotDate.toISOString();
          if (!bookedSlots.has(isoString)) {
            availableSlots.push({
              dateTime: isoString,
              date: slotDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
              time: slotDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
              dayOfWeek,
            });
          }
        }
      }

      return res.status(200).json({ success: true, slots: availableSlots });

    } catch (err) {
      console.error('GET availability error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: creator saves their weekly availability ──────────────────────────
  if (req.method === 'POST') {
    try {
      const { creatorCode, slots } = req.body;
      // slots = [{ dayOfWeek: 1, hour: 14, minute: 0 }, ...]

      if (!creatorCode || !Array.isArray(slots)) {
        return res.status(400).json({ error: 'creatorCode and slots array required' });
      }

      await db.collection('availability').doc(creatorCode).set({
        creatorCode,
        slots,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({ success: true });

    } catch (err) {
      console.error('POST availability error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
