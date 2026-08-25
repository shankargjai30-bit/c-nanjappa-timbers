import dotenv from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

dotenv.config();

let adminApp;

export async function getTestIdToken() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    adminApp = initializeApp({
      credential: cert(serviceAccount)
    });
  } else {
    adminApp = getApps()[0];
  }

  const auth = getAuth(adminApp);
  const customToken = await auth.createCustomToken('test-manager-uid', {
    role: 'manager'
  });

  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to exchange custom token: ${err}`);
  }

  const data = await res.json();
  return data.idToken;
}
