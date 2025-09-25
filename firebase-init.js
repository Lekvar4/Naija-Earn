<script type="module">
// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBvWBJ45YSWoJwhRdxKSenrJ1pwcERLV4s",
  authDomain: "naijaearn-6d914.firebaseapp.com",
  projectId: "naijaearn-6d914",
  storageBucket: "naijaearn-6d914.firebasestorage.app",
  messagingSenderId: "187057450801",
  appId: "1:187057450801:web:e02de3eaacbd0673574a10",
  measurementId: "G-Z0NDLB643E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Make them global
window.auth = auth;
window.db = db;
</script>