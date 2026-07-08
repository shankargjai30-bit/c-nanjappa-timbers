import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const admin = {
  initializeApp: (opts) => initializeApp(opts),
  credential: { cert },
  auth: () => getAuth()
};

export default admin;
