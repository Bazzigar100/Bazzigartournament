
// 🔥 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAtAt7f794mOGC89V298Ai6TViRA7RV5Sk",
  authDomain: "bazzigar-tournament.firebaseapp.com",
  projectId: "bazzigar-tournament",
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let tournaments = [];

// 🔐 LOGIN / SIGNUP
function login() {
  const email = prompt("Enter Email");
  const password = prompt("Enter Password");

  if (!email || !password) {
    alert("Enter email & password");
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then(() => startApp())
    .catch(() => {
      auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
          db.collection("users").doc(auth.currentUser.uid).set({
            balance: 100
          });
          startApp();
        })
        .catch(err => alert(err.message));
    });
}

// 🚀 START APP
function startApp() {
  currentUser = auth.currentUser;

  document.getElementById("auth").style.display = "none";
  document.getElementById("app").style.display = "block";

  // Load data
  loadBalance();
  loadTournaments();
  loadLeaderboard();

  // Create slots
  createSlots("slots1", 48); // BR 1PM
  createSlots("slots2", 48); // BR 9PM
  createSlots("clash1", 8);  // Clash 3PM
  createSlots("clash2", 8);  // Clash 5PM
}

// 💰 LOAD BALANCE
function loadBalance() {
  db.collection("users").doc(currentUser.uid).get()
    .then(doc => {
      if (doc.exists) {
        document.getElementById("balance").innerText = doc.data().balance;
      }
    });
}

// 🎮 LOAD TOURNAMENTS
function loadTournaments() {
  const container = document.getElementById("tournaments");
  container.innerHTML = "";

  db.collection("tournaments").get().then(snapshot => {
    tournaments = [];

    snapshot.forEach(doc => {
      const t = { id: doc.id, ...doc.data() };
      tournaments.push(t);

      const div = document.createElement("div");
      div.className = "card";

      div.innerHTML = `
        <h3>${t.name}</h3>
        <p>Entry: ₹${t.entry}</p>
        <p>Prize: ₹${t.prize}</p>
        <p>Status: ${t.status}</p>
        <button onclick="joinTournament('${t.id}')">Join</button>
      `;

      container.appendChild(div);
    });
  });
}

// 🎮 JOIN TOURNAMENT
function joinTournament(id) {
  const t = tournaments.find(x => x.id === id);
  const userRef = db.collection("users").doc(currentUser.uid);

  db.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    let balance = doc.data().balance;

    if (balance >= t.entry) {
      balance -= t.entry;

      transaction.update(userRef, { balance });

      await db.collection("joined").add({
        userId: currentUser.uid,
        tournamentId: id,
        time: new Date()
      });

      alert("✅ Joined Successfully!");

      if (t.status === "live") {
        showRoomDetails(t);
      } else {
        alert("⏳ Room will unlock before match");
      }

      loadBalance();
    } else {
      alert("❌ Low Balance!");
    }
  });
}

// 🔑 ROOM DETAILS
function showRoomDetails(t) {
  document.getElementById("roomBox").style.display = "block";
  document.getElementById("roomId").innerText = "Room ID: " + t.roomId;
  document.getElementById("roomPass").innerText = "Password: " + t.roomPassword;
}

// 🏆 LEADERBOARD
function loadLeaderboard() {
  const list = document.getElementById("leaderboard");
  list.innerHTML = "";

  db.collection("joined")
    .orderBy("time", "desc")
    .limit(10)
    .get()
    .then(snapshot => {
      snapshot.forEach(doc => {
        const data = doc.data();

        const li = document.createElement("li");
        li.innerText = `User: ${data.userId}`;

        list.appendChild(li);
      });
    });
}

// 🔥 SLOT SYSTEM
let selectedSlot = null;
let selectedMatch = null;

// CREATE SLOTS
function createSlots(containerId, totalSlots = 48) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  for (let i = 1; i <= totalSlots; i++) {
    const btn = document.createElement("button");
    btn.innerText = i;
    btn.className = "slot-btn available";

    btn.onclick = () => openPopup(i, containerId);

    container.appendChild(btn);
  }
}

// OPEN POPUP
function openPopup(slot, match) {
  selectedSlot = slot;
  selectedMatch = match;

  document.getElementById("popup").style.display = "flex";
}

// CLOSE POPUP
function closePopup() {
  document.getElementById("popup").style.display = "none";
}

// CONFIRM SLOT JOIN
function confirmJoin() {
  const name = document.getElementById("playerName").value;
  const uid = document.getElementById("playerUid").value;

  if (!name || !uid) {
    alert("Enter all details");
    return;
  }

  const entryFee = 100;
  const userRef = db.collection("users").doc(currentUser.uid);

  db.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    let balance = doc.data().balance;

    if (balance >= entryFee) {
      balance -= entryFee;

      transaction.update(userRef, { balance });

      // Detect match type
      let matchType = selectedMatch.includes("clash")
        ? "Clash Headshot"
        : "BR Custom";

      await db.collection("slots").add({
        userId: currentUser.uid,
        name,
        uid,
        slot: selectedSlot,
        match: selectedMatch,
        type: matchType,
        time: new Date()
      });

      alert("✅ Slot booked successfully!");

      closePopup();
      loadBalance();
    } else {
      alert("❌ Not enough balance");
    }
  });
}

// 🚪 LOGOUT
function logout() {
  auth.signOut().then(() => location.reload());
}

// ➕ ADD MONEY REQUEST
function addMoneyRequest() {
  const amount = Number(document.getElementById("addAmount").value);

  if (!amount || amount <= 0) {
    alert("Enter valid amount");
    return;
  }

  db.collection("transactions").add({
    userId: currentUser.uid,
    type: "add",
    amount,
    status: "pending",
    time: new Date()
  });

  alert("✅ Add money request sent!");
}

// ➖ WITHDRAW REQUEST
function withdrawRequest() {
  const amount = Number(document.getElementById("withdrawAmount").value);

  if (!amount || amount <= 0) {
    alert("Enter valid amount");
    return;
  }

  const userRef = db.collection("users").doc(currentUser.uid);

  userRef.get().then(doc => {
    let balance = doc.data().balance;

    if (balance < amount) {
      alert("❌ Not enough balance");
      return;
    }

    db.collection("transactions").add({
      userId: currentUser.uid,
      type: "withdraw",
      amount,
      status: "pending",
      time: new Date()
    });

    alert("💸 Withdraw request sent!");
  });
}

// ➕ CONFIRM ADD MONEY (QR BASED)
function confirmAddMoney() {
  const amount = Number(document.getElementById("addAmount").value);

  if (!amount || amount <= 0) {
    alert("Enter valid amount");
    return;
  }

  db.collection("transactions").add({
    userId: currentUser.uid,
    type: "add",
    amount,
    status: "pending",
    method: "QR",
    time: new Date()
  });

  alert("✅ Payment submitted! Wait for approval.");
}

// ➖ WITHDRAW REQUEST
function withdrawRequest() {
  const amount = Number(document.getElementById("withdrawAmount").value);
  const upi = document.getElementById("upiId").value;

  if (!amount || amount <= 0 || !upi) {
    alert("Enter all details");
    return;
  }

  const userRef = db.collection("users").doc(currentUser.uid);

  userRef.get().then(doc => {
    let balance = doc.data().balance;

    if (balance < amount) {
      alert("❌ Not enough balance");
      return;
    }

    db.collection("transactions").add({
      userId: currentUser.uid,
      type: "withdraw",
      amount,
      upi,
      status: "pending",
      time: new Date()
    });

    alert("💸 Withdraw request sent!");
  });
}

// OPEN QR POPUP
function openQr() {
  document.getElementById("qrPopup").style.display = "flex";
}

// CLOSE QR POPUP
function closeQr() {
  document.getElementById("qrPopup").style.display = "none";
}
// 💰 CONFIRM ADD MONEY (QR)
function confirmAddMoney() {
  const amount = Number(document.getElementById("addAmount").value);

  if (!amount || amount <= 0) {
    alert("Enter valid amount");
    return;
  }

  db.collection("transactions").add({
    userId: currentUser.uid,
    type: "add",
    amount,
    status: "pending",
    method: "QR",
    time: new Date()
  });

  alert("✅ Payment submitted!");
  closeQr(); // closes popup
}

// 📊 LOAD PAYMENT HISTORY
function loadHistory() {
  const container = document.getElementById("historyList");
  container.innerHTML = "";

  db.collection("transactions")
    .where("userId", "==", currentUser.uid)
    .orderBy("time", "desc")
    .onSnapshot(snapshot => {

      container.innerHTML = "";

      snapshot.forEach(doc => {
        const t = doc.data();

        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `
          <p>Type: ${t.type}</p>
          <p>Amount: ₹${t.amount}</p>
          <p>Status: ${t.status}</p>
        `;

        container.appendChild(div);
      });

    });
}