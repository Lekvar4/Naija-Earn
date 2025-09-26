// script.js (module) — single-file Firebase integration for all pages
// IMPORTANT: include in your HTML as: <script type="module" src="script.js"></script>

// --------- Firebase imports (modular SDK) ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit,
  runTransaction,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// --------- Your Firebase config (you already provided) ----------
const firebaseConfig = {
  apiKey: "AIzaSyBvWBJ45YSWoJwhRdxKSenrJ1pwcERLV4s",
  authDomain: "naijaearn-6d914.firebaseapp.com",
  projectId: "naijaearn-6d914",
  storageBucket: "naijaearn-6d914.firebasestorage.app",
  messagingSenderId: "187057450801",
  appId: "1:187057450801:web:e02de3eaacbd0673574a10",
  measurementId: "G-Z0NDLB643E"
};

// --------- Initialize Firebase ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --------- Helper utils ----------
const money = n => "₦" + (Number(n || 0)).toLocaleString();
const byId = id => document.getElementById(id);

// show inline message helper
function showInline(el, message, color = "green") {
  if (!el) return;
  el.textContent = message;
  el.style.color = color;
}

// live bottom alert (used for fake + real withdraws)
const liveAlertEl = byId("liveAlert");
function showLive(text) {
  if (!liveAlertEl) return;
  liveAlertEl.textContent = text;
  liveAlertEl.classList.add("show");
  setTimeout(() => liveAlertEl.classList.remove("show"), 5000);
}

// simulate occasional fake alerts
(function fakeAlertLoop(){
  if (!liveAlertEl) return;
  const names = ["Nkechi","Tunde","Chinedu","Aisha","Ngozi","Musa","Segun","Amaka","Ife","Bolanle","Emeka"];
  const cities = ["Lagos","Abuja","Ibadan","Port Harcourt","Enugu","Kano","Kaduna"];
  const tick = () => {
    const name = names[Math.floor(Math.random()*names.length)];
    const city = cities[Math.floor(Math.random()*cities.length)];
    const amount = (Math.floor(Math.random()*50) + 10) * 1000; // ₦10k - ₦60k
    showLive(`${name} from ${city} just withdrew ${money(amount)}`);
    const next = Math.floor(Math.random()*12000) + 8000;
    setTimeout(tick, next);
  };
  setTimeout(tick, 4000);
})();

// --------- Common: password toggle wiring for inputs with class .pw-toggle (optional) ----------
function wirePasswordToggles() {
  document.querySelectorAll(".password-wrapper").forEach(wrapper => {
    const input = wrapper.querySelector("input[type='password'], input[type='text']");
    const toggle = wrapper.querySelector(".toggle-password");
    if (!input || !toggle) return;
    toggle.addEventListener("click", () => {
      if (input.type === "password") {
        input.type = "text";
        toggle.textContent = "🙈";
      } else {
        input.type = "password";
        toggle.textContent = "👁";
      }
    });
  });
}

// --------- Auth state handling (updates UI when a user logs in/out) ----------
let CURRENT_USER = null;        // firebase User object
let CURRENT_PROFILE = null;     // user profile doc data (from collection 'users')

onAuthStateChanged(auth, async user => {
  CURRENT_USER = user;
  if (!user) {
    // if the page needs auth, redirect to login
    if (document.querySelector("[data-requires-auth]")) {
      window.location.href = "login.html";
    } else {
      // make sure dashboard elements are cleared
      if (byId("welcome")) byId("welcome").textContent = "Hello, Guest";
    }
    return;
  }

  // load user profile doc
  try {
    const uDoc = await getDoc(doc(db, "users", user.uid));
    if (!uDoc.exists()) {
      // rare: auth exists but profile not created
      CURRENT_PROFILE = null;
      console.warn("User authenticated but profile missing in firestore:", user.uid);
      return;
    }
    CURRENT_PROFILE = uDoc.data();
    CURRENT_PROFILE._id = uDoc.id;
  } catch (err) {
    console.error("Error loading user profile:", err);
  }

  // Update UI elements across pages if present
  if (byId("welcome")) byId("welcome").textContent = `Hello, ${CURRENT_PROFILE?.username || user.email || "User"}`;
  if (byId("userFull")) byId("userFull").textContent = CURRENT_PROFILE?.fullname || "";
  if (byId("balance")) byId("balance").textContent = money(CURRENT_PROFILE?.balance || 0);
  if (byId("infoUsername")) byId("infoUsername").textContent = CURRENT_PROFILE?.username || "";
  if (byId("infoFullname")) byId("infoFullname").textContent = CURRENT_PROFILE?.fullname || "";
  if (byId("infoFirstPaid")) byId("infoFirstPaid").textContent = (CURRENT_PROFILE?.firstWithdrawalPaid ? "Yes" : "No");

  // if on dashboard, load activities
  if (byId("activityList")) loadActivities();
});

// --------- SIGNUP page wiring (signup.html) ----------
const signupForm = byId("signupForm");
if (signupForm) {
  wirePasswordToggles();

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = (byId("code").value || "").trim();
    const fullname = (byId("fullname").value || "").trim();
    const username = (byId("username").value || "").trim();
    const password = (byId("password").value || "").trim();
    const msg = byId("signupMsg");

    if (!code || !fullname || !username || !password) {
      showInline(msg, "Please fill all fields.", "red");
      return;
    }

    try {
      // check code doc
      const codeRef = doc(db, "signupCodes", code);
      const codeSnap = await getDoc(codeRef);
      if (!codeSnap.exists()) {
        showInline(msg, "Invalid signup code.", "red");
        return;
      }
      if (codeSnap.data().used) {
        showInline(msg, "This signup code has already been used.", "red");
        return;
      }

      // create auth user with pseudo-email (we don't collect real email here)
      const email = `${username}@naijaearn.local`;
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // create profile in Firestore
      const profile = {
        username,
        fullname,
        balance: 0,
        createdAt: serverTimestamp(),
        firstWithdrawalPaid: false,
        firstWithdrawalFeeCharged: false // whether the ₦1,000 was deducted from balance
      };
      await setDoc(doc(db, "users", cred.user.uid), profile);

      // mark code as used
      await updateDoc(codeRef, { used: true, usedBy: cred.user.uid, usedAt: serverTimestamp() });

      showInline(msg, "Account created successfully — redirecting to login...", "green");
      signupForm.reset();
      setTimeout(() => window.location.href = "login.html", 1200);
    } catch (err) {
      console.error(err);
      showInline(msg, (err.message || "Signup failed"), "red");
    }
  });
}

// --------- LOGIN page wiring (login.html and index home login) ----------
const loginForm = byId("loginForm");
const homeLoginForm = byId("homeLoginForm");

async function handleLoginWithUsernameAndPass(username, password, feedbackEl) {
  try {
    if (!username || !password) {
      showInline(feedbackEl, "Fill username and password", "red");
      return;
    }
    const email = `${username}@naijaearn.local`;
    await signInWithEmailAndPassword(auth, email, password);
    // redirect handled by auth state change
    showInline(feedbackEl, "Login successful — redirecting...", "green");
    setTimeout(() => window.location.href = "dashboard.html", 600);
  } catch (err) {
    console.error(err);
    showInline(feedbackEl, err.message || "Login failed", "red");
  }
}

if (loginForm) {
  // password toggle if present
  const pwrap = loginForm.querySelector("div[style*='position:relative']") || loginForm;
  const toggle = byId("toggleLoginPass");
  if (toggle) toggle.addEventListener("click", () => {
    const pass = byId("loginPass");
    if (!pass) return;
    if (pass.type === "password") { pass.type = "text"; toggle.textContent = "🙈"; } else { pass.type = "password"; toggle.textContent = "👁"; }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = (byId("loginUser").value || "").trim();
    const password = (byId("loginPass").value || "").trim();
    const msg = byId("loginMsg");
    await handleLoginWithUsernameAndPass(username, password, msg);
  });
}

if (homeLoginForm) {
  // home quick login supports username or email
  const homeToggle = byId("homeToggle");
  if (homeToggle) homeToggle.addEventListener("click", () => {
    const p = byId("homePass");
    if (!p) return;
    if (p.type === "password") { p.type = "text"; homeToggle.textContent = "Hide"; } else { p.type = "password"; homeToggle.textContent = "Show"; }
  });

  homeLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const identifier = (byId("homeUser").value || "").trim();
    const password = (byId("homePass").value || "").trim();
    const msg = byId("homeMsg");

    if (!identifier || !password) { showInline(msg, "Fill credentials", "red"); return; }

    try {
      let username = identifier;
      if (identifier.includes("@")) {
        // try to resolve email -> username by searching users collection
        // but we created pseudo emails only, so user probably used username
        // try sign in directly with email
        await signInWithEmailAndPassword(auth, identifier, password);
        localStorage.setItem("userId", auth.currentUser.uid);
        window.location.href = "dashboard.html";
        return;
      } else {
        await handleLoginWithUsernameAndPass(identifier, password, msg);
      }
    } catch (err) {
      console.error(err);
      showInline(msg, err.message || "Login error", "red");
    }
  });
}

// --------- DASHBOARD page wiring (mining, auto-mine, withdraw quick, activity) ----------
if (byId("mineBtn") || byId("autoMineBtn") || byId("withdrawForm")) {
  // requires auth — mark pages that require auth so auth state redirect works
  document.body.setAttribute("data-requires-auth", "1");
}

let autoMineInterval = null;

// update balance in Firestore safely using transaction-like increment and log activity
async function adjustBalanceAndLog(uid, amount, activityText) {
  if (!uid) throw new Error("No uid");
  const userRef = doc(db, "users", uid);

  // atomic increment for balance
  await updateDoc(userRef, { balance: increment(amount) });

  // add activity
  const actCol = collection(userRef, "activity");
  await addDoc(actCol, { text: activityText, at: serverTimestamp() });

  // refresh CURRENT_PROFILE from server
  const refreshed = await getDoc(userRef);
  CURRENT_PROFILE = refreshed.data();
  CURRENT_PROFILE._id = refreshed.id;

  // update small UI if present
  if (byId("balance")) byId("balance").textContent = money(CURRENT_PROFILE.balance);
  if (byId("infoFirstPaid")) byId("infoFirstPaid").textContent = (CURRENT_PROFILE.firstWithdrawalPaid ? "Yes" : "No");
  if (byId("activityList")) loadActivities();
}

if (byId("mineBtn")) {
  byId("mineBtn").addEventListener("click", async () => {
    if (!CURRENT_USER) { showLive("Please log in to mine."); return; }
    try {
      await adjustBalanceAndLog(CURRENT_USER.uid, 200, "Mined ₦200");
    } catch (err) { console.error(err); showLive("Mining error"); }
  });
}

if (byId("autoMineBtn")) {
  byId("autoMineBtn").addEventListener("click", function() {
    if (!CURRENT_USER) { showLive("Please log in to auto-mine."); return; }
    if (autoMineInterval) {
      clearInterval(autoMineInterval); autoMineInterval = null;
      this.textContent = "Start Auto Mine";
    } else {
      this.textContent = "Stop Auto Mine";
      autoMineInterval = setInterval(async () => {
        try { await adjustBalanceAndLog(CURRENT_USER.uid, 100, "Auto-mined ₦100"); } catch(e){ console.error(e); }
      }, 6000);
    }
  });
}

// load activity list (recent)
async function loadActivities() {
  if (!CURRENT_USER) return;
  const actCol = collection(doc(db, "users", CURRENT_USER.uid), "activity");
  // simple snapshot of latest 10
  try {
    const q = query(actCol, orderBy("at", "desc"), limit(20));
    const snap = await getDocs(q);
    const list = byId("activityList");
    if (!list) return;
    if (snap.empty) { list.innerHTML = "<p class='small'>No activity yet.</p>"; return; }
    const items = [];
    snap.forEach(s => {
      const d = s.data();
      const time = d.at && d.at.toDate ? d.at.toDate().toLocaleString() : "";
      items.push(`<div style="padding:6px 0;border-bottom:1px solid #f2f9f5;"><div style="font-weight:700">${d.text}</div><div class="small">${time}</div></div>`);
    });
    list.innerHTML = items.join("");
  } catch (err) {
    console.error("loadActivities err:", err);
  }
}

// DASHBOARD withdraw (quick) — same logic as withdrawal page, but we keep both working
const withdrawFormQuick = byId("withdrawForm");
if (withdrawFormQuick) {
  withdrawFormQuick.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!CURRENT_USER) { showInline(byId("withdrawMsg"), "Please login first", "red"); return; }

    const bank = (byId("bank").value || "").trim();
    const acct = (byId("acct").value || "").trim();
    if (!bank || !acct) { showInline(byId("withdrawMsg"), "Provide bank & account", "red"); return; }

    try {
      const userRef = doc(db, "users", CURRENT_USER.uid);
      const uSnap = await getDoc(userRef);
      const pdata = uSnap.data();
      if (!pdata) { showInline(byId("withdrawMsg"), "User profile missing", "red"); return; }

      if ((pdata.balance || 0) < 5000) { showInline(byId("withdrawMsg"), "Need at least ₦5,000 to withdraw.", "red"); return; }

      if (!pdata.firstWithdrawalPaid) {
        // instruct user to pay the fee first — create a "Confirm fee paid" button in UI
        const msgEl = byId("withdrawMsg");
        msgEl.style.color = "orange";
        msgEl.innerHTML = `You must pay ₦1,000 first to Opay (8138691157). After paying, click <button id="confirmFeeBtn" class="btn" style="padding:6px 8px;margin-left:8px;">I paid ₦1,000</button>`;
        const btn = byId("confirmFeeBtn");
        if (btn) {
          btn.addEventListener("click", async () => {
            // apply fee deduction immediately (since user claims to have paid off-site)
            const fee = 1000;
            // run transaction to avoid race conditions
            await runTransaction(db, async (t) => {
              const cur = await t.get(userRef);
              const curBal = cur.data().balance || 0;
              const newBal = Math.max(0, curBal - fee);
              t.update(userRef, { balance: newBal, firstWithdrawalPaid: true, firstWithdrawalFeeCharged: true });
            });
            // log activity
            await addDoc(collection(userRef, "activity"), { text: `Paid ₦1,000 withdrawal fee (Opay)`, at: serverTimestamp() });
            // refresh UI
            const refreshed = await getDoc(userRef);
            CURRENT_PROFILE = refreshed.data();
            CURRENT_PROFILE._id = refreshed.id;
            if (byId("balance")) byId("balance").textContent = money(CURRENT_PROFILE.balance);
            showInline(byId("withdrawMsg"), "Fee marked as paid. Now submit withdrawal again.", "green");
            if (byId("infoFirstPaid")) byId("infoFirstPaid").textContent = "Yes";
          });
        }
        return;
      }

      // proceed with withdrawal: withdraw full available balance or prompt for amount? We use full available balance here
      // For dashboard quick withdraw we will request the full balance
      const amountToWithdraw = pdata.balance; // fee already deducted earlier
      if (amountToWithdraw <= 0) { showInline(byId("withdrawMsg"), "No withdrawable balance after fee.", "red"); return; }

      // create withdrawal request
      await addDoc(collection(db, "withdrawals"), {
        userId: CURRENT_USER.uid,
        username: pdata.username,
        bank,
        account: acct,
        amount: amountToWithdraw,
        feeApplied: (pdata.firstWithdrawalFeeCharged ? 1000 : 0),
        status: "pending",
        createdAt: serverTimestamp()
      });

      // set user balance to 0
      await updateDoc(doc(db, "users", CURRENT_USER.uid), { balance: 0 });
      await addDoc(collection(doc(db, "users", CURRENT_USER.uid), "activity"), { text: `Requested withdrawal ${money(amountToWithdraw)} to ${bank} (${acct})`, at: serverTimestamp() });

      // refresh UI
      const refreshed = await getDoc(doc(db, "users", CURRENT_USER.uid));
      CURRENT_PROFILE = refreshed.data();
      CURRENT_PROFILE._id = refreshed.id;
      if (byId("balance")) byId("balance").textContent = money(CURRENT_PROFILE.balance);
      loadActivities();
      showInline(byId("withdrawMsg"), "Withdrawal requested. Admin will process it.", "green");
    } catch (err) {
      console.error("withdraw err:", err);
      showInline(byId("withdrawMsg"), "Error submitting withdrawal.", "red");
    }
  });
}

// --------- WITHDRAW page wiring (withdraw.html) ----------
// If withdraw.html exists we wire the separate withdraw page form as well
const withdrawFormPage = byId("withdrawForm");
if (withdrawFormPage && !withdrawFormQuick) { // if dashboard already wired, skip duplicate
  // create and wire confirm fee button inside fee-box if present
  const feeBox = document.querySelector(".fee-box");
  if (feeBox) {
    const confirmHtml = `<div style="margin-top:10px"><button id="confirmFeeBtnPage" class="btn">I paid ₦1,000 (Confirm)</button></div>`;
    feeBox.insertAdjacentHTML("beforeend", confirmHtml);
  }

  withdrawFormPage.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!CURRENT_USER) { showInline(byId("withdrawMessage"), "Please login first", "red"); return; }

    const bank = (byId("bankName").value || "").trim();
    const acct = (byId("accountNumber").value || "").trim();
    const amt = Number(byId("withdrawAmount").value || 0);

    if (!bank || !acct || !amt) { showInline(byId("withdrawMessage"), "Fill all fields", "red"); return; }

    try {
      const userRef = doc(db, "users", CURRENT_USER.uid);
      const uSnap = await getDoc(userRef);
      const pdata = uSnap.data();
      if (!pdata) { showInline(byId("withdrawMessage"), "Profile missing", "red"); return; }

      if (amt < 5000) { showInline(byId("withdrawMessage"), "Minimum withdrawal ₦5,000", "red"); return; }
      if (amt > pdata.balance) { showInline(byId("withdrawMessage"), "Insufficient balance", "red"); return; }

      if (!pdata.firstWithdrawalPaid) {
        showInline(byId("withdrawMessage"), `Pay ₦1,000 first to Opay (8138691157) then click "I paid" below.`, "orange");
        // wire confirm button
        const cb = byId("confirmFeeBtnPage");
        if (cb) {
          cb.addEventListener("click", async () => {
            // deduct fee now
            await runTransaction(db, async (t) => {
              const cur = await t.get(userRef);
              const curBal = cur.data().balance || 0;
              const newBal = Math.max(0, curBal - 1000);
              t.update(userRef, { balance: newBal, firstWithdrawalPaid: true, firstWithdrawalFeeCharged: true });
            });
            await addDoc(collection(userRef, "activity"), { text: `Paid ₦1,000 withdrawal fee (Opay)`, at: serverTimestamp() });
            showInline(byId("withdrawMessage"), "Fee confirmed — submit withdrawal again.", "green");
          }, { once: true });
        }
        return;
      }

      // proceed: create withdrawal request and deduct amount
      await addDoc(collection(db, "withdrawals"), {
        userId: CURRENT_USER.uid,
        username: pdata.username,
        bank,
        account: acct,
        amount: amt,
        feeApplied: (pdata.firstWithdrawalFeeCharged ? 1000 : 0),
        status: "pending",
        createdAt: serverTimestamp()
      });

      // deduct amount from user
      await updateDoc(userRef, { balance: pdata.balance - amt });

      await addDoc(collection(userRef, "activity"), { text: `Requested withdrawal ${money(amt)} to ${bank} (${acct})`, at: serverTimestamp() });

      showInline(byId("withdrawMessage"), `✅ Withdrawal request ₦${amt} submitted.`, "green");
    } catch (err) {
      console.error("withdrawPage err:", err);
      showInline(byId("withdrawMessage"), "Error processing withdrawal.", "red");
    }
  });
}

// --------- ADMIN page wiring (admin.html) ----------
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123"; // change this in file when deploying
const adminLoginForm = byId("adminLoginForm");
const adminPanel = byId("adminPanel");
const adminLoginCard = byId("adminLoginCard");
if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = (byId("adminUser").value || "").trim();
    const p = (byId("adminPass").value || "").trim();
    const msg = byId("adminMsg");
    if (u === ADMIN_USERNAME && p === ADMIN_PASSWORD) {
      sessionStorage.setItem("naija_admin", "1");
      adminLoginCard.style.display = "none";
      adminPanel.style.display = "block";
      refreshAdminView();
    } else {
      showInline(msg, "Wrong admin credentials", "red");
    }
  });

  // if session exists show panel
  if (sessionStorage.getItem("naija_admin")) {
    adminLoginCard.style.display = "none";
    adminPanel.style.display = "block";
    refreshAdminView();
  }
}

// generate codes button
const genCodeBtn = byId("genCodeBtn");
if (genCodeBtn) {
  genCodeBtn.addEventListener("click", async () => {
    const count = Math.max(1, parseInt(byId("genCount").value || "1"));
    const batch = [];
    for (let i=0;i<count;i++){
      const code = "CODE" + Math.random().toString(36).substr(2,6).toUpperCase() + Math.floor(Math.random()*999);
      // create doc with ID = code
      try {
        await setDoc(doc(db, "signupCodes", code), { createdAt: serverTimestamp(), used: false });
      } catch(err) { console.error("gen code err", err); }
      batch.push(code);
    }
    refreshAdminView();
  });
}

// refresh admin view (codes, users, withdraws)
async function refreshAdminView() {
  // codes
  try {
    const codesSnap = await getDocs(collection(db, "signupCodes"));
    const codesBox = byId("codesBox");
    if (codesBox) {
      const items = [];
      codesSnap.forEach(c => {
        const d = c.data();
        const id = c.id;
        items.push(`<div style="background:#f1fff3;padding:8px 10px;border-radius:8px;border:1px solid #e6f6ea;margin:6px;display:inline-block">${id} ${d.used ? "<small style='color:orange'>(used)</small>" : ""}<a href="#" data-del="${id}" style="color:#006838;margin-left:8px;font-weight:700">×</a></div>`);
      });
      codesBox.innerHTML = items.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px;">${items.join("")}</div>` : "<div class='small'>No active codes</div>";
      // attach delete handlers
      codesBox.querySelectorAll("[data-del]").forEach(el => el.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const id = el.getAttribute("data-del");
        try { await deleteDoc(doc(db, "signupCodes", id)); refreshAdminView(); } catch(err){ console.error(err); }
      }));
    }
  } catch(err){ console.error("refresh codes err", err); }

  // users
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const ub = byId("userBox");
    if (ub) {
      const rows = [];
      usersSnap.forEach(u => {
        const d = u.data();
        rows.push(`<tr><td>${d.username}</td><td>${d.fullname || ""}</td><td>${money(d.balance||0)}</td><td>${d.firstWithdrawalPaid ? "Yes" : "No"}</td><td>${d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleDateString() : "-"}</td></tr>`);
      });
      ub.innerHTML = usersSnap.empty ? "<div class='small'>No users yet</div>" : `<table class="table"><thead><tr><th>User</th><th>Full name</th><th>Balance</th><th>FirstPaid</th><th>Joined</th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
    }
  } catch(err){ console.error("refresh users err", err); }

  // withdrawals
  try {
    const q = query(collection(db, "withdrawals"), orderBy("createdAt", "desc"));
    const wSnap = await getDocs(q);
    const wb = byId("withdrawBox");
    if (wb) {
      if (wSnap.empty) { wb.innerHTML = "<div class='small'>No withdrawal requests</div>"; }
      else {
        const html = [];
        wSnap.forEach(w => {
          const d = w.data();
          const id = w.id;
          html.push(`<div style="padding:10px;border-bottom:1px solid #f2f9f5" class="withdraw-item">
            <div>
              <div style="font-weight:800">${d.username} — ${money(d.amount)}</div>
              <div class="small">${d.bank} • ${d.account} • ${d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toLocaleString() : "-"}</div>
              <div class="small">Fee: ${money(d.feeApplied || 0)} • Status: <strong>${d.status}</strong></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
              ${d.status === 'pending' ? `<button class="btn" data-approve="${id}">Approve</button>` : `<button class="btn secondary" disabled>Completed</button>`}
              <button class="btn secondary" data-delete="${id}">Delete</button>
            </div>
          </div>`);
        });
        wb.innerHTML = html.join("");
        // attach handlers
        wb.querySelectorAll("[data-approve]").forEach(btn => btn.addEventListener("click", ev => {
          const id = btn.getAttribute("data-approve"); approveWithdraw(id);
        }));
        wb.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", ev => {
          const id = btn.getAttribute("data-delete"); deleteWithdraw(id);
        }));
      }
    }
  } catch(err){ console.error("refresh withdraws err", err); }
}

// approve withdraw (admin)
async function approveWithdraw(id) {
  try {
    const wRef = doc(db, "withdrawals", id);
    const wSnap = await getDoc(wRef);
    if (!wSnap.exists()) { alert("Not found"); return; }
    const w = wSnap.data();

    // update withdrawal status
    await updateDoc(wRef, { status: "completed", processedAt: serverTimestamp() });

    // log in user's activity
    const userActivityCol = collection(doc(db, "users", w.userId), "activity");
    await addDoc(userActivityCol, { text: `Withdrawal ${money(w.amount)} processed by admin`, at: serverTimestamp() });

    // show live alert
    showLive(`${w.username} from platform just withdrew ${money(w.amount)}`);

    refreshAdminView();
  } catch (err) {
    console.error("approveWithdraw err", err);
  }
}

// delete withdraw
async function deleteWithdraw(id) {
  try {
    await deleteDoc(doc(db, "withdrawals", id));
    refreshAdminView();
  } catch(err) { console.error("deleteWithdraw err", err); }
}

// Admin logout button
const adminLogoutBtn = byId("adminLogoutBtn");
if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("naija_admin");
    adminPanel.style.display = "none";
    adminLoginCard.style.display = "block";
  });
}

// If withdraws update in DB, show live alerts when approved (real-time listener)
try {
  const wCol = collection(db, "withdrawals");
  onSnapshot(wCol, (snap) => {
    snap.docChanges().forEach(change => {
      if (change.type === "modified") {
        const d = change.doc.data();
        if (d.status === "completed") {
          showLive(`${d.username} just withdrew ${money(d.amount)}`);
        }
      }
    });
  });
} catch(e) { /* ignore if onSnapshot fails early */ }

// --------- Logout UI button (unified) ----------
const logoutBtns = document.querySelectorAll("[id^='logoutBtn'], #accountLogout");
logoutBtns.forEach(b => {
  b.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await signOut(auth);
      localStorage.removeItem("userId");
      window.location.href = "index.html";
    } catch (err) { console.error("logout err", err); window.location.href = "index.html"; }
  });
});

// Wire password toggles on page load
document.addEventListener("DOMContentLoaded", () => wirePasswordToggles());