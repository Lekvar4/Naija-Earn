/* script.js - full front-end logic (localStorage) for Naija Earn */

/* ===== Storage Keys & Admin creds ===== */
const USERS_KEY = "naija_users_v1";
const CODES_KEY = "naija_codes_v1";
const WITHDRAW_KEY = "naija_withdrawals_v1";
const CURRENT_USER = "naija_current_user";
const ADMIN_SESSION = "naija_admin_session";

const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123"; // change when deploying

/* ===== Utilities ===== */
function read(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}
function write(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function saveUsers(arr) { write(USERS_KEY, arr); }
function saveCodes(arr) { write(CODES_KEY, arr); }
function saveWithdraws(arr) { write(WITHDRAW_KEY, arr); }
function now() { return new Date().toISOString(); }
function money(n) { return "₦" + Number(n).toLocaleString(); }

/* initialize if not present */
if (!localStorage.getItem(CODES_KEY)) write(CODES_KEY, []);
if (!localStorage.getItem(USERS_KEY)) write(USERS_KEY, []);
if (!localStorage.getItem(WITHDRAW_KEY)) write(WITHDRAW_KEY, []);

/* ===== Live Alert (bottom) ===== */
const alertEl = document.getElementById("liveAlert");
function showLive(text) {
  if (!alertEl) return;
  alertEl.textContent = text;
  alertEl.classList.add("show");
  setTimeout(()=> alertEl.classList.remove("show"), 5000);
}
/* show random simulated alerts plus real withdraws when approved */
(function liveAlertLoop(){
  if (!alertEl) return;
  const names = ["Nkechi","Tunde","Chinedu","Aisha","Ngozi","Musa","Segun","Amaka","Ife","Bolanle","Emeka"];
  const cities = ["Lagos","Abuja","Ibadan","Port Harcourt","Enugu","Kano","Kaduna"];
  setTimeout(function tick(){
    const name = names[Math.floor(Math.random()*names.length)];
    const city = cities[Math.floor(Math.random()*cities.length)];
    const amount = (Math.floor(Math.random()*50) + 10) * 1000; // ₦10k - ₦60k
    showLive(`${name} from ${city} just withdrew ${money(amount)}`);
    setTimeout(tick, Math.floor(Math.random()*12000) + 8000);
  }, 3500);
})();

/* ===== Home quick login (index.html) ===== */
const homeLoginForm = document.getElementById("homeLoginForm");
if (homeLoginForm) {
  homeLoginForm.addEventListener("submit", e=>{
    e.preventDefault();
    const u = document.getElementById("homeUser").value.trim();
    const p = document.getElementById("homePass").value.trim();
    const users = read(USERS_KEY);
    const user = users.find(x=> x.username === u && x.password === p);
    if (!user) return document.getElementById("signupMsg") ? document.getElementById("signupMsg").innerText = "Invalid login" : alert("Invalid login");
    localStorage.setItem(CURRENT_USER, u);
    window.location = "dashboard.html";
  });
}

/* ===== Signup (signup.html) ===== */
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", e=>{
    e.preventDefault();
    const code = document.getElementById("code").value.trim();
    const fullname = document.getElementById("fullname").value.trim();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    const codes = read(CODES_KEY);
    if (!codes.includes(code)) {
      return document.getElementById("signupMsg").innerText = "Invalid or used signup code.";
    }
    let users = read(USERS_KEY);
    if (users.find(u => u.username === username)) {
      return document.getElementById("signupMsg").innerText = "Username already exists.";
    }

    // create user object
    const newUser = {
      username,
      password,
      fullname,
      balance: 0,
      createdAt: now(),
      firstWithdrawPaid: false,
      activity: [{time: now(), text: "Account created."}]
    };
    users.push(newUser);
    saveUsers(users);

    // remove used code (one-time)
    const remaining = codes.filter(c=> c !== code);
    saveCodes(remaining);

    document.getElementById("signupMsg").innerText = "Account created — go to login.";
    setTimeout(()=> window.location = "login.html", 1200);
  });
}

/* ===== Login (login.html) ===== */
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", e=>{
    e.preventDefault();
    const username = document.getElementById("loginUser").value.trim();
    const password = document.getElementById("loginPass").value.trim();
    const users = read(USERS_KEY);
    const user = users.find(u => u.username === username && u.password === password);
    const msg = document.getElementById("loginMsg");
    if (!user) {
      if (msg) msg.innerText = "Invalid username or password.";
      return;
    }
    localStorage.setItem(CURRENT_USER, username);
    // redirect
    window.location = "dashboard.html";
  });
}

/* ===== Dashboard logic (dashboard.html) ===== */
const mineBtn = document.getElementById("mineBtn");
const autoMineBtn = document.getElementById("autoMineBtn");
const balanceEl = document.getElementById("balance");
const welcomeEl = document.getElementById("welcome");
const userFullEl = document.getElementById("userFull");
const activityList = document.getElementById("activityList");
const accountLogout = document.getElementById("accountLogout");
const infoUsername = document.getElementById("infoUsername");
const infoFullname = document.getElementById("infoFullname");
const infoFirstPaid = document.getElementById("infoFirstPaid");

let autoMineInterval = null;
function getCurrentUser() {
  const cu = localStorage.getItem(CURRENT_USER);
  if (!cu) return null;
  const users = read(USERS_KEY);
  return users.find(u => u.username === cu) || null;
}
function saveCurrentUser(userObj) {
  const users = read(USERS_KEY).map(u => u.username === userObj.username ? userObj : u);
  saveUsers(users);
}

/* initialize dashboard view */
if (document.body.contains(document.getElementById("welcome"))) {
  const cur = getCurrentUser();
  if (!cur) { window.location = "login.html"; }
  else {
    welcomeEl.innerText = `Hello, ${cur.username} 👋`;
    userFullEl.innerText = cur.fullname || "";
    balanceEl.innerText = money(cur.balance || 0);
    renderActivity(cur);
    infoUsername.innerText = cur.username;
    infoFullname.innerText = cur.fullname || "";
    infoFirstPaid.innerText = cur.firstWithdrawPaid ? "Yes" : "No";
  }

  // single mine click - +200
  mineBtn.addEventListener("click", ()=>{
    const cur2 = getCurrentUser();
    cur2.balance = Number(cur2.balance) + 200;
    cur2.activity.unshift({time: now(), text: "Mined ₦200"});
    saveCurrentUser(cur2);
    balanceEl.innerText = money(cur2.balance);
    renderActivity(cur2);
  });

  // auto mine toggle
  autoMineBtn.addEventListener("click", ()=>{
    if (autoMineInterval) {
      clearInterval(autoMineInterval); autoMineInterval = null; autoMineBtn.innerText = "Start Auto Mine";
    } else {
      autoMineBtn.innerText = "Stop Auto Mine";
      autoMineInterval = setInterval(()=>{
        const cur3 = getCurrentUser();
        cur3.balance = Number(cur3.balance) + 100;
        cur3.activity.unshift({time: now(), text: "Auto-mined ₦100"});
        saveCurrentUser(cur3);
        balanceEl.innerText = money(cur3.balance);
        renderActivity(cur3);
      }, 6000);
    }
  });

  // logout
  if (accountLogout) accountLogout.addEventListener("click", ()=>{
    localStorage.removeItem(CURRENT_USER);
    window.location = "login.html";
  });

  // withdraw form
  const withdrawForm = document.getElementById("withdrawForm");
  const withdrawMsg = document.getElementById("withdrawMsg");
  if (withdrawForm) {
    withdrawForm.addEventListener("submit", e=>{
      e.preventDefault();
      const bank = document.getElementById("bank").value;
      const acct = document.getElementById("acct").value.trim();
      if (!bank || !acct) return withdrawMsg.innerText = "Provide bank and account number.";
      let cur4 = getCurrentUser();
      if (Number(cur4.balance) < 5000) return withdrawMsg.innerText = "You need at least ₦5,000 to withdraw.";
      // Apply first-withdraw fee if not paid
      let feeApplied = 0;
      if (!cur4.firstWithdrawPaid) {
        feeApplied = 1000;
        cur4.firstWithdrawPaid = true;
        cur4.activity.unshift({time: now(), text: `₦1,000 first-withdraw fee applied.`});
      }
      // Calculate amount to withdraw (we withdraw full available balance minus fee)
      const amountToWithdraw = Number(cur4.balance) - feeApplied;
      if (amountToWithdraw <= 0) {
        withdrawMsg.innerText = "After fee there is no withdrawable amount.";
        saveCurrentUser(cur4);
        return;
      }

      // Create withdrawal request
      const withdraws = read(WITHDRAW_KEY);
      const w = {
        id: "W" + Math.floor(Math.random()*9999999),
        username: cur4.username,
        bank,
        acct,
        amount: amountToWithdraw,
        fee: feeApplied,
        status: "pending",
        requestedAt: now()
      };
      withdraws.unshift(w);
      saveWithdraws(withdraws);

      // Deduct full balance (user balance becomes 0)
      cur4.activity.unshift({time: now(), text: `Requested withdrawal ${money(amountToWithdraw)} (fee ${money(feeApplied)})`});
      cur4.balance = 0;
      saveCurrentUser(cur4);

      // update UI
      balanceEl.innerText = money(cur4.balance);
      renderActivity(cur4);
      withdrawMsg.innerText = "Withdrawal requested. Admin will process it.";
    });
  }
}

/* render activity list */
function renderActivity(userObj) {
  if (!activityList) return;
  const items = userObj.activity || [];
  if (items.length === 0) activityList.innerHTML = "<p class='small'>No activity yet.</p>";
  else {
    activityList.innerHTML = items.slice(0,20).map(i => `<div style="padding:6px 0;border-bottom:1px solid #f2f9f5;"><div style="font-weight:700">${i.text}</div><div class="small">${new Date(i.time).toLocaleString()}</div></div>`).join("");
  }
}

/* ===== Admin logic (admin.html) ===== */
const adminLoginForm = document.getElementById("adminLoginForm");
const adminPanel = document.getElementById("adminPanel");
const adminLoginCard = document.getElementById("adminLoginCard");
if (adminLoginForm) {
  adminLoginForm.addEventListener("submit", e=>{
    e.preventDefault();
    const u = document.getElementById("adminUser").value.trim();
    const p = document.getElementById("adminPass").value.trim();
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      sessionStorage.setItem(ADMIN_SESSION, "1");
      adminLoginCard.style.display = "none";
      adminPanel.style.display = "block";
      refreshAdminView();
    } else {
      document.getElementById("adminMsg").innerText = "Wrong admin login.";
    }
  });
}

/* Admin logout */
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
if (adminLogoutBtn) adminLogoutBtn.addEventListener("click", ()=>{
  sessionStorage.removeItem(ADMIN_SESSION);
  adminPanel.style.display = "none";
  adminLoginCard.style.display = "block";
});

/* Generate codes */
const genCodeBtn = document.getElementById("genCodeBtn");
if (genCodeBtn) {
  genCodeBtn.addEventListener("click", ()=>{
    const count = Math.max(1, parseInt(document.getElementById("genCount").value) || 1);
    const codes = read(CODES_KEY);
    for (let i=0;i<count;i++){
      const newC = "CODE" + Math.random().toString(36).substr(2,6).toUpperCase() + Math.floor(Math.random()*999);
      codes.push(newC);
    }
    saveCodes(codes);
    refreshAdminView();
  });
}

/* Refresh admin view */
function refreshAdminView(){
  // codes
  const codes = read(CODES_KEY);
  const cb = document.getElementById("codesBox");
  if (cb) {
    cb.innerHTML = codes.length === 0 ? "<div class='small'>No active codes</div>" :
      `<div style="display:flex;flex-wrap:wrap;gap:8px;">${codes.map(c=>`<div style="background:#f1fff3;padding:8px 10px;border-radius:8px;border:1px solid #e6f6ea">${c} <a href="#" data-del="${c}" style="color:#006838;margin-left:8px;font-weight:700">×</a></div>`).join("")}</div>`;
    // attach delete handlers
    cb.querySelectorAll("[data-del]").forEach(el=>{
      el.addEventListener("click", (ev)=>{
        ev.preventDefault();
        const codeToDel = el.getAttribute("data-del");
        const remaining = codes.filter(x=> x !== codeToDel);
        saveCodes(remaining);
        refreshAdminView();
      });
    });
  }

  // users
  const users = read(USERS_KEY);
  const ub = document.getElementById("userBox");
  if (ub) {
    ub.innerHTML = users.length === 0 ? "<div class='small'>No users yet</div>" :
      `<table class="table"><thead><tr><th>User</th><th>Full name</th><th>Balance</th><th>FirstPaid</th><th>Joined</th></tr></thead><tbody>${users.map(u=>`<tr><td>${u.username}</td><td>${(u.fullname||"")}</td><td>${money(u.balance||0)}</td><td>${u.firstWithdrawPaid? "Yes": "No"}</td><td>${new Date(u.createdAt).toLocaleDateString()}</td></tr>`).join("")}</tbody></table>`;
  }

  // withdrawals
  const withdraws = read(WITHDRAW_KEY);
  const wb = document.getElementById("withdrawBox");
  if (wb) {
    if (withdraws.length === 0) wb.innerHTML = "<div class='small'>No withdrawal requests</div>";
    else {
      wb.innerHTML = withdraws.map(w => `
        <div style="padding:10px;border-bottom:1px solid #f2f9f5" class="withdraw-item">
          <div>
            <div style="font-weight:800">${w.username} — ${money(w.amount)}</div>
            <div class="small">${w.bank} • ${w.acct} • ${new Date(w.requestedAt).toLocaleString()}</div>
            <div class="small">Fee: ${money(w.fee)} • Status: <strong>${w.status}</strong></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
            ${w.status === 'pending' ? `<button class="btn" data-approve="${w.id}">Approve</button>` : `<button class="btn secondary" disabled>Completed</button>`}
            <button class="btn secondary" data-delete="${w.id}">Delete</button>
          </div>
        </div>
      `).join("");
      // attach handlers
      wb.querySelectorAll("[data-approve]").forEach(btn=>{
        btn.addEventListener("click", ev=>{
          const id = btn.getAttribute("data-approve");
          approveWithdraw(id);
        });
      });
      wb.querySelectorAll("[data-delete]").forEach(btn=>{
        btn.addEventListener("click", ev=>{
          const id = btn.getAttribute("data-delete");
          deleteWithdraw(id);
        });
      });
    }
  }
}

/* Approve withdraw (admin) */
function approveWithdraw(id) {
  const withdraws = read(WITHDRAW_KEY);
  const idx = withdraws.findIndex(w => w.id === id);
  if (idx === -1) return alert("Not found");
  withdraws[idx].status = "completed";
  withdraws[idx].processedAt = now();
  saveWithdraws(withdraws);

  // update user activity
  const users = read(USERS_KEY);
  const user = users.find(u=> u.username === withdraws[idx].username);
  if (user) {
    user.activity.unshift({time: now(), text: `Withdrawal ${money(withdraws[idx].amount)} processed by admin.`});
    saveUsers(users);
  }

  // show a live alert of completed withdraw
  showLive(`${withdraws[idx].username} just withdrew ${money(withdraws[idx].amount)}`);

  refreshAdminView();
}

/* Delete withdraw */
function deleteWithdraw(id) {
  let withdraws = read(WITHDRAW_KEY);
  withdraws = withdraws.filter(w => w.id !== id);
  saveWithdraws(withdraws);
  refreshAdminView();
}

/* If admin session present, show admin panel */
if (sessionStorage.getItem(ADMIN_SESSION) && adminPanel) {
  adminLoginCard.style.display = "none";
  adminPanel.style.display = "block";
  refreshAdminView();
}

/* Make Admin link visible on all pages (already in template) */
/* End of script.js */
function togglePassword(inputId, icon) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    icon.textContent = "🙈"; // change eye icon
  } else {
    input.type = "password";
    icon.textContent = "👁"; // back to eye
  }
}

