import admin from 'firebase-admin';
import webpush from 'web-push';

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

// Fix VAPID contact: ensure it's a valid URL
let vapidContact = process.env.VAPID_CONTACT_EMAIL || 'mailto:you@example.com';
if (vapidContact && !vapidContact.startsWith('mailto:') && !vapidContact.startsWith('https://')) {
  vapidContact = `mailto:${vapidContact}`;
}

webpush.setVapidDetails(
  vapidContact,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { title, body, url } = req.body;
  if (!title && !body) return res.status(400).json({ error: 'Missing title or body' });

  try {
    const snapshot = await db.collection('subscriptions').get();
    if (snapshot.empty) return res.status(200).json({ message: 'No subscribers yet' });

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
          console.error('Push failed', err);
          return null;
        })
      );
    });

    await Promise.all(promises);
    return res.status(200).json({ success: true, count: snapshot.size });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
