import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAJ-tzX4jxRIYG_jJpURN43riIfvLWgTvA",
  authDomain: "c-nanjappa-timber-traders.firebaseapp.com",
  projectId: "c-nanjappa-timber-traders",
  storageBucket: "c-nanjappa-timber-traders.firebasestorage.app",
  messagingSenderId: "986583354147",
  appId: "1:986583354147:web:2f3cd3b6736d80cf641a96",
  measurementId: "G-4VYRKFD1GG"
};

// Initialize Firebase safely (Singleton)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Only initialize analytics if supported to prevent crashes in some environments
let analytics;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

export { app, auth, analytics };
