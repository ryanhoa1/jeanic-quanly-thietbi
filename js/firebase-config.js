// Firebase Configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDd50N1NSJrF1dbvmuiQ1Fd6NaI-ArohAc",
  authDomain: "jeanic-it-assets.firebaseapp.com",
  projectId: "jeanic-it-assets",
  storageBucket: "jeanic-it-assets.firebasestorage.app",
  messagingSenderId: "385116689675",
  appId: "1:385116689675:web:c940b184df9da94ea47e0e",
  measurementId: "G-XFZFWWWC7X"
};

export const ADMIN_EMAILS = ["hoa.bui@jeanicgarment.com"];

let auth = null;
let db = null;
let useFirebase = false;

try {
  if (typeof firebase !== "undefined") {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    useFirebase = true;
  }
} catch (err) {
  console.error("Không khởi tạo được Firebase — chuyển sang chế độ cục bộ.", err);
  useFirebase = false;
}

export { auth, db, useFirebase };
