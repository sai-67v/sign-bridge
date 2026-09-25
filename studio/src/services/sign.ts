import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "../libs/firebase";
import { auth } from "../libs/firebase";

export const signIn = (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const signUp = (email: string, password: string) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const verifyEmail = async () => {
  auth.currentUser && (await sendEmailVerification(auth.currentUser));
};

export const sendResetPassword = (email: string) => {
  return sendPasswordResetEmail(auth, email)
}
