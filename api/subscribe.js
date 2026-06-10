import admin from 'firebase-admin';

export const config = {
  runtime: 'nodejs20.x',
};

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
  // === CORS - Must be at the very top ===
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const subscription = req.body;

    if (!subscription?.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    // Safe document ID
    const safeId = subscription.endpoint.substring(0, 150).replace(/[^a-zA-Z0-9_-]/g, '_');

    await db.collection('subscriptions').doc(safeId).set({
      ...subscription,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Subscription saved');
    return res.status(201).json({ success: true });
  } catch (error) {
    console.error('❌ Subscribe error:', error);
    return res.status(500).json({ 
      error: 'Failed to save subscription',
      message: error.message 
    });
  }
}
