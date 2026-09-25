
// MOCK FIREBASE for Local Mode
// This file satisfies imports from legacy code but does nothing.

export const app = {};
export const auth = {
  currentUser: { uid: 'local-user-123', email: 'local@canis.note' }
};
export const db = {};
export const storage = {};
export const storageEnabled = false;

export class Timestamp {
  seconds: number;
  nanoseconds: number;

  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  toDate() {
    return new Date(this.seconds * 1000);
  }

  toMillis() {
    return this.seconds * 1000 + this.nanoseconds / 1000000;
  }

  static now() {
    return new Timestamp(Date.now() / 1000, 0);
  }

  static fromMillis(millis: number) {
    return new Timestamp(millis / 1000, 0);
  }

  static fromDate(date: Date) {
    return new Timestamp(date.getTime() / 1000, 0);
  }
}

// Mock Types
export type Unsubscribe = () => void;
export type QueryDocumentSnapshot<T = any> = {
  id: string;
  ref: any;
  data: () => T;
  exists: () => boolean;
};
export type DocumentData = any;

// Mock Firestore Functions
export const collection = (db: any, path: string) => ({ path });
export const doc = (db: any, path: string, ...segments: string[]) => ({ path: path + segments.join('/') });
export const getDoc = async (ref: any) => ({
  exists: () => false,
  data: () => undefined,
  id: 'mock-id'
});
export const getDocs = async (query: any) => ({
  empty: true,
  docs: [] as QueryDocumentSnapshot[],
  forEach: (fn: any) => { }
});
export const setDoc = async (ref: any, data: any) => { };
export const updateDoc = async (ref: any, data: any) => { };
export const addDoc = async (ref: any, data: any) => ({ id: 'mock-id' });
export const deleteDoc = async (ref: any) => { };
export const onSnapshot = (ref: any, callback: any) => {
  return () => { }; // unsubscribe
};
export const query = (ref: any, ...constraints: any[]) => ({});
export const where = (field: string, op: string, value: any) => ({});
export const orderBy = (field: string, dir?: string) => ({});
export const limit = (n: number) => ({});
export const startAfter = (doc: any) => ({});
export const runTransaction = async (db: any, updateFunction: any) => { };
export const or = (...args: any[]) => ({});
export const and = (...args: any[]) => ({});

// Mock Auth
export const signOut = async (auth: any) => { };
export const updatePassword = async (user: any, pass: string) => { };
export const onAuthStateChanged = (auth: any, cb: any) => {
  cb(auth.currentUser);
  return () => { };
};
export const createUserWithEmailAndPassword = async (auth: any, email: string, pass: string) => ({ user: { uid: 'new-user', email } });
export const sendEmailVerification = async (user: any) => { };
export const sendPasswordResetEmail = async (auth: any, email: string) => { };
export const signInWithEmailAndPassword = async (auth: any, email: string, pass: string) => ({ user: { uid: 'local-user-123', email } });

// Mock Storage
export const ref = (storage: any, path: string) => ({ path });
export const listAll = async (ref: any) => ({ items: [] });
export const getDownloadURL = async (ref: any) => "http://localhost:3000/logo192.png";
export const uploadBytes = async (ref: any, file: any) => { };
export const deleteObject = async (ref: any) => { };
