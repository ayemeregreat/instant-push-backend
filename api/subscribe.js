import admin from 'firebase-admin';

export const config = {
  runtime: 'nodejs20.x',
};

// Initialize Firebase only once
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (e) {
    console.error('❌ Firebase init failed:', e.message);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const subscription = req.body;

    if (!subscription?.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    const safeId = Buffer.from(subscription.endpoint.substring(0, 100)).toString('base64').replace(/[^a-zA-Z0-9]/g, '_');

    await db.collection('subscriptions').doc(safeId).set({
      ...subscription,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('Subscribe error:', error);
    return res.status(500).json({ 
      error: 'Failed to save subscription',
      message: error.message 
    });
  }
}
