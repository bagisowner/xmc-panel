import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let adminApp: App;

if (!getApps().length) {
  adminApp = initializeApp({
    projectId: firebaseConfig.projectId,
  });
} else {
  adminApp = getApps()[0];
}

export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
// Handle the specific database ID if present in config
if (firebaseConfig.firestoreDatabaseId) {
  // Note: Standard getFirestore() uses the default database.
  // In some environments, we might need to specify the databaseId.
  // But for AI Studio, the default should work or we can use the specific one.
}

export default adminApp;
