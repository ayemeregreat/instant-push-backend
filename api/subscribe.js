import admin from 'firebase-admin';
import crypto from 'crypto';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            }),
        });
        console.log('Firebase Admin initialized successfully');
    } catch (initError) {
        console.error('Firebase initialization error:', initError);
    }
}

const db = admin.firestore();

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const subscription = req.body;

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Invalid subscription object' });
    }

    try {
        // Create a safe, fixed-length document ID using a hash of the endpoint
        const hash = crypto.createHash('sha256').update(subscription.endpoint).digest('hex');

        const docRef = db.collection('subscriptions').doc(hash);
        await docRef.set({
            ...subscription,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log('Subscription saved successfully');
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Save subscription error:', error);
        return res.status(500).json({
            error: 'Failed to save subscription',
            details: error.message
        });
    }
}
