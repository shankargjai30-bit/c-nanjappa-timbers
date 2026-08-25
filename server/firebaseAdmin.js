import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';

dotenv.config();

let adminApp;

try {
  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountStr) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not defined in the environment.');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountStr);
  } catch (parseError) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON data.');
  }

  if (!getApps().length) {
    adminApp = initializeApp({
      credential: cert(serviceAccount)
    });
    console.log("SUCCESS: Firebase Admin initialized securely from environment.");
  } else {
    adminApp = getApps()[0];
  }
} catch (error) {
  console.error("FATAL: Failed to initialize Firebase Admin.", error.message);
  process.exit(1);
}

const admin = {
  auth: () => getAuth(adminApp)
};

export default admin;
