import admin from 'firebase-admin';
import crypto from 'crypto';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  // ... CORS headers same as above ...

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const subscription = req.body;

    if (!subscription?.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    // Create a safe document ID
    const hash = crypto.createHash('sha256').update(subscription.endpoint).digest('hex');

    await db.collection('subscriptions')
      .doc(hash)
      .set({
        ...subscription,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('Subscription save error:', error);
    return res.status(500).json({ 
      error: 'Failed to save subscription',
      message: error.message 
    });
  }
}
