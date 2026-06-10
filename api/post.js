import admin from 'firebase-admin';
import webpush from 'web-push';

// Initialize Firebase Admin SDK
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

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_CONTACT_EMAIL || 'mailto:you@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// CORS helper
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(res);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, body, url } = req.body;
  if (!title && !body) {
    return res.status(400).json({ error: 'Missing title or body' });
  }

  try {
    // Get all subscriptions from Firestore
    const snapshot = await db.collection('subscriptions').get();
    if (snapshot.empty) {
      return res.status(200).json({ message: 'No subscribers yet' });
    }

    // Build notification payload
    const payload = JSON.stringify({
      title: title || 'New post',
      body: body || 'Someone just posted',
      icon: '/icon-192.png',   // optional – will be served from your PWA
      badge: '/badge-96.png',  // optional
      data: { url: url || '/' },
    });

    // Send push to every subscription, clean up expired ones
    const promises = [];
    snapshot.forEach(doc => {
      const subscription = doc.data();
      promises.push(
        webpush.sendNotification(subscription, payload).catch(err => {
          // If subscription is expired or gone (410/404), delete it from DB
          if (err.statusCode === 410 || err.statusCode === 404) {
            console.log('Removing expired subscription:', subscription.endpoint);
            return doc.ref.delete();
          }
          console.error('Push failed for', subscription.endpoint, err);
          return null;
        })
      );
    });

    await Promise.all(promises);
    res.status(200).json({ success: true, count: snapshot.size });
  } catch (error) {
    console.error('Error sending pushes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
