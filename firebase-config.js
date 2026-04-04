// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyBBmZHDicqT-7DbSF7ZGMdPJhCCP6fFlEY",
  authDomain: "moviemate-57ddb.firebaseapp.com",
  projectId: "moviemate-57ddb",
  storageBucket: "moviemate-57ddb.firebasestorage.app",
  messagingSenderId: "1098626760598",
  appId: "1:1098626760598:web:a21b50f96b1e62323c27b7",
  measurementId: "G-J0RLLD532E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);