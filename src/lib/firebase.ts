import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA_CCgkiItZLgcxgs6iRUoF7RbBKU4lwMM",
  authDomain: "wishlist-cfd57.firebaseapp.com",
  projectId: "wishlist-cfd57",
  storageBucket: "wishlist-cfd57.firebasestorage.app",
  messagingSenderId: "1082917185282",
  appId: "1:1082917185282:web:2bef15c49596adb6b2041b",
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };