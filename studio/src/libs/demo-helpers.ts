// Demo mode helpers
export const DEMO_MODE = process.env.REACT_APP_DEMO_MODE === 'true' || !process.env.REACT_APP_FIREBASE_API_KEY;

export const getCurrentUser = () => {
  if (DEMO_MODE) {
    const demoUser = localStorage.getItem('demoUser');
    if (demoUser) {
      const user = JSON.parse(demoUser);
      return { uid: user.uid, email: user.email };
    }
    return null;
  }

  // Return auth.currentUser but we need to import it dynamically
  const { auth } = require('./firebase');
  return auth?.currentUser || null;
};
