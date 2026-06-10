import admin from 'firebase-admin';
import webpush from 'web-push';

// Debug: log environment variables (without exposing full private key)
console.log('VAPID_PUBLIC_KEY exists?', !!process.env.VAPID_PUBLIC_KEY);
console.log('VAPID_PRIVATE_KEY exists?', !!process.env.VAPID_PRIVATE_KEY);
console.log('VAPID_CONTACT_EMAIL exists?', !!process.env.VAPID_CONTACT_EMAIL);
console.log('FIREBASE_PROJECT_ID exists?', !!process.env.FIREBASE_PROJECT_ID);

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase initialized');
  } catch (err) {
    console.error('Firebase init error:', err.message);
    throw err; // crash with clear error
  }
}

const db = admin.firestore();

// Check VAPID keys before setting
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  throw new Error('Missing VAPID keys in environment');
}

webpush.setVapidDetails(
  process.env.VAPID_CONTACT_EMAIL || 'mailto:you@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, body, url } = req.body;
  if (!title && !body) {
    return res.status(400).json({ error: 'Missing title or body' });
  }

  try {
    const snapshot = await db.collection('subscriptions').get();
    if (snapshot.empty) {
      return res.status(200).json({ message: 'No subscribers yet' });
    }

    const payload = JSON.stringify({
      title: title || 'New post',
      body: body || 'Someone just posted',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      data: { url: url || '/' },
    });

    const promises = [];
    snapshot.forEach(doc => {
      const subscription = doc.data();
      promises.push(
        webpush.sendNotification(subscription, payload).catch(err => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            return doc.ref.delete();
          }
          console.error('Push failed for', subscription.endpoint, err);
          return null;
        })
      );
    });

    await Promise.all(promises);
    return res.status(200).json({ success: true, count: snapshot.size });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
