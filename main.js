import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, query, where, orderBy, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCfqZD7UZZt-GWmtNhfJyksrv3-8ENRjto",
  authDomain: "insan-cemerlang-d5574.firebaseapp.com",
  projectId: "insan-cemerlang-d5574",
  storageBucket: "insan-cemerlang-d5574.appspot.com",
  messagingSenderId: "1035937160050",
  appId: "1:1035937160050:web:6d77d3874c3f78b2811beb",
  measurementId: "G-EVVQ80Q08C"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const booksCol = collection(db, "books");
const loansCol = collection(db, "borrowings");
const usersCol = collection(db, "users");

let currentUser = null;
let currentRole = null;
let currentUserData = null;
let books = [];
let loans = [];
let members = [];

// DOM Auth
const authContainer = document.getElementById("authContainer");
const dashboardContainer = document.getElementById("dashboardContainer");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const registerBtn = document.getElementById("registerBtn");
const regUsername = document.getElementById("regUsername");
const regFullname = document.getElementById("regFullname");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");
const regConfirmPassword = document.getElementById("regConfirmPassword");
const authError = document.getElementById("authError");
const authInfo = document.getElementById("authInfo");
const userNameDisplay = document.getElementById("userNameDisplay");
const userRoleDisplay = document.getElementById("userRoleDisplay");
const logoutBtn = document.getElementById("logoutBtn");
const backToLoginBtn = document.getElementById("backToLoginBtn");
const menuContainer = document.getElementById("menuContainer");
const contentPanel = document.getElementById("contentPanel");
const genericModal = document.getElementById("genericModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalSaveBtn = document.getElementById("modalSaveBtn");
const modalCloseBtn = document.getElementById("modalCloseBtn");

let currentMenu = "";
let selectedLoginRole = "admin";

function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]); }

// Registrasi user baru
async function registerUser(username, fullname, email, password, role) {
  const usernameQuery = query(usersCol, where("username", "==", username));
  const existing = await getDocs(usernameQuery);
  if (!existing.empty) throw new Error("Username sudah digunakan");
  const emailQuery = query(usersCol, where("email", "==", email));
  const existingEmail = await getDocs(emailQuery);
  if (!existingEmail.empty) throw new Error("Email sudah terdaftar");
  if (role === "admin") {
    const adminQuery = query(usersCol, where("role", "==", "admin"));
    const adminSnap = await getDocs(adminQuery);
    if (!adminSnap.empty) throw new Error("Admin sudah ada, tidak bisa mendaftar admin lagi");
  }
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", userCred.user.uid), {
    username, fullname, email, role, createdAt: new Date()
  });
  return userCred.user;
}

async function loginWithUsername(username, password, role) {
  const q = query(usersCol, where("username", "==", username), where("role", "==", role));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Username atau role tidak ditemukan");
  const userDoc = snap.docs[0];
  const email = userDoc.data().email;
  await signInWithEmailAndPassword(auth, email, password);
  return userDoc.data();
}

// ======================= DASHBOARD ADMIN =======================
function renderAdminDashboard() {
  const menus = [
    { id: "manageBooks", label: "📚 Kelola Buku", icon: "fas fa-book" },
    { id: "manageTransactions", label: "📋 Kelola Transaksi", icon: "fas fa-exchange-alt" },
    { id: "manageMembers", label: "👥 Kelola Anggota", icon: "fas fa-users" }
  ];
  menuContainer.innerHTML = menus.map(m => `<div class="menu-card" data-menu="${m.id}"><i class="${m.icon}"></i><h4>${m.label}</h4></div>`).join('');
  document.querySelectorAll(".menu-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".menu-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      currentMenu = card.dataset.menu;
      if (currentMenu === "manageBooks") renderManageBooks();
      else if (currentMenu === "manageTransactions") renderManageTransactions();
      else if (currentMenu === "manageMembers") renderManageMembers();
    });
  });
  document.querySelector(".menu-card").click();
}

async function renderManageBooks() {
  contentPanel.innerHTML = `<div><button class="btn-primary" id="addBookBtn">+ Tambah Buku</button><div id="booksListAdmin"></div></div>`;
  const booksDiv = document.getElementById("booksListAdmin");
  const unsubscribe = onSnapshot(query(booksCol, orderBy("title")), (snap) => {
    books = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    booksDiv.innerHTML = `
      <table style="margin-top:1rem; width:100%">
        <thead><tr><th>Judul</th><th>Penulis</th><th>Tahun</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${books.map(book => `
          <tr>
            <td>${escapeHtml(book.title)}</td>
            <td>${escapeHtml(book.author)}</td>
            <td>${book.year}</td>
            <td>${book.isAvailable ? 'Tersedia' : 'Dipinjam'}</td>
            <td><button class="editBookBtn" data-id="${book.id}" style="background:#ffedd5; border:none; padding:4px 10px; border-radius:1rem;">Edit</button> <button class="deleteBookBtn" data-id="${book.id}" style="background:#fee2e2; border:none; padding:4px 10px; border-radius:1rem;">Hapus</button></td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
    document.querySelectorAll(".editBookBtn").forEach(btn => btn.addEventListener("click", () => openBookModal(btn.dataset.id)));
    document.querySelectorAll(".deleteBookBtn").forEach(btn => btn.addEventListener("click", async () => { if(confirm("Hapus buku?")) await deleteDoc(doc(db, "books", btn.dataset.id)); }));
  });
  document.getElementById("addBookBtn").onclick = () => openBookModal(null);
}

function openBookModal(bookId) {
  const book = bookId ? books.find(b => b.id === bookId) : null;
  modalTitle.innerText = book ? "Edit Buku" : "Tambah Buku";
  modalBody.innerHTML = `
    <input id="bookTitle" placeholder="Judul" value="${book ? escapeHtml(book.title) : ''}">
    <input id="bookAuthor" placeholder="Penulis" value="${book ? escapeHtml(book.author) : ''}">
    <input id="bookYear" placeholder="Tahun" value="${book ? book.year : ''}">
  `;
  genericModal.style.display = "flex";
  const saveHandler = async () => {
    const title = document.getElementById("bookTitle").value.trim();
    const author = document.getElementById("bookAuthor").value.trim();
    const year = parseInt(document.getElementById("bookYear").value);
    if (!title || !author || !year) return alert("Isi semua data");
    if (bookId) {
      await updateDoc(doc(db, "books", bookId), { title, author, year });
    } else {
      await addDoc(booksCol, { title, author, year, isAvailable: true, borrowerName: "" });
    }
    genericModal.style.display = "none";
  };
  modalSaveBtn.onclick = saveHandler;
  modalCloseBtn.onclick = () => genericModal.style.display = "none";
}

async function renderManageTransactions() {
  contentPanel.innerHTML = `<div><button class="btn-primary" id="addTransactionBtn">+ Pinjam Buku (Manual)</button><input type="text" id="searchTrans" placeholder="Cari peminjam/buku" style="margin-left:1rem; padding:0.3rem; border-radius:2rem; border:1px solid #ccc;"><div id="transactionsList"></div></div>`;
  const transDiv = document.getElementById("transactionsList");
  const searchInput = document.getElementById("searchTrans");
  const unsubscribe = onSnapshot(query(loansCol, orderBy("borrowDate", "desc")), async (snap) => {
    loans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    let filtered = loans;
    if (searchInput && searchInput.value) {
      const term = searchInput.value.toLowerCase();
      filtered = loans.filter(l => l.borrowerName.toLowerCase().includes(term) || (l.bookTitle || "").toLowerCase().includes(term));
    }
    transDiv.innerHTML = `
      <table style="margin-top:1rem">
        <thead><tr><th>Buku</th><th>Peminjam</th><th>Tgl Pinjam</th><th>Jatuh Tempo</th><th>Status</th><th>Denda</th><th>Aksi</th></tr></thead>
        <tbody>${filtered.map(loan => {
          const isReturned = !!loan.returnDate;
          let fineDisplay = "-";
          if (!isReturned) {
            const today = new Date();
            const due = new Date(loan.dueDate);
            if (today > due) fineDisplay = "<span class='fine-badge'>Rp10.000 (terlambat)</span>";
          } else if (loan.fine) fineDisplay = `<span class='fine-badge'>Rp${loan.fine}</span>`;
          return `
            <tr>
              <td>${escapeHtml(loan.bookTitle)}</td>
              <td>${escapeHtml(loan.borrowerName)}</td>
              <td>${loan.borrowDate}</td>
              <td>${loan.dueDate}</td>
              <td>${isReturned ? "Dikembalikan" : "Dipinjam"}</td>
              <td>${fineDisplay}</td>
              <td>
                ${!isReturned ? `<button class="returnTransBtn" data-id="${loan.id}" data-bookid="${loan.bookId}" style="background:#ffedd5; border:none; padding:4px 10px; border-radius:1rem;">Kembalikan</button>` : ''}
                <button class="deleteTransBtn" data-id="${loan.id}" style="background:#fee2e2; border:none; padding:4px 10px; border-radius:1rem;">Hapus</button>
               </td>
            </tr>
          `;
        }).join('')}</tbody>
      </table>
    `;
    document.querySelectorAll(".returnTransBtn").forEach(btn => btn.addEventListener("click", async () => { await returnBook(btn.dataset.id, btn.dataset.bookid); }));
    document.querySelectorAll(".deleteTransBtn").forEach(btn => btn.addEventListener("click", async () => { if(confirm("Hapus transaksi?")) await deleteDoc(doc(db, "borrowings", btn.dataset.id)); }));
  });
  if (searchInput) searchInput.addEventListener("input", () => {});
  document.getElementById("addTransactionBtn").onclick = () => openManualBorrowModal();
}

async function returnBook(loanId, bookId) {
  const loanRef = doc(db, "borrowings", loanId);
  const loanSnap = await getDoc(loanRef);
  if (!loanSnap.exists()) return;
  const loan = loanSnap.data();
  if (loan.returnDate) return alert("Sudah dikembalikan");
  const due = new Date(loan.dueDate);
  const today = new Date();
  let fine = today > due ? 10000 : 0;
  if (confirm(fine ? `Terlambat! Denda Rp10.000. Lanjutkan?` : "Kembalikan buku?")) {
    await updateDoc(loanRef, { returnDate: new Date().toISOString().split('T')[0], fine });
    await updateDoc(doc(db, "books", bookId), { isAvailable: true, borrowerName: "" });
    alert("Buku dikembalikan");
  }
}

function openManualBorrowModal() {
  modalTitle.innerText = "Pinjam Buku (Manual)";
  const availableBooks = books.filter(b => b.isAvailable);
  modalBody.innerHTML = `
    <select id="bookSelect"><option value="">Pilih Buku</option>${availableBooks.map(b => `<option value="${b.id}">${escapeHtml(b.title)}</option>`).join('')}</select>
    <input id="borrowerName" placeholder="Nama Peminjam">
    <input type="text" id="borrowDate" placeholder="Tanggal Pinjam">
    <input type="text" id="dueDate" placeholder="Jatuh Tempo">
  `;
  flatpickr("#borrowDate", { dateFormat: "Y-m-d", defaultDate: new Date() });
  flatpickr("#dueDate", { dateFormat: "Y-m-d", defaultDate: new Date(Date.now() + 7*86400000) });
  genericModal.style.display = "flex";
  modalSaveBtn.onclick = async () => {
    const bookId = document.getElementById("bookSelect").value;
    const borrower = document.getElementById("borrowerName").value.trim();
    const borrowDate = document.getElementById("borrowDate").value;
    const dueDate = document.getElementById("dueDate").value;
    if (!bookId || !borrower || !borrowDate || !dueDate) return alert("Lengkapi data");
    const book = books.find(b => b.id === bookId);
    if (!book || !book.isAvailable) return alert("Buku tidak tersedia");
    await addDoc(loansCol, {
      bookId, bookTitle: book.title, borrowerName: borrower, borrowerEmail: "",
      borrowDate, dueDate, returnDate: null, fine: 0, status: "borrowed"
    });
    await updateDoc(doc(db, "books", bookId), { isAvailable: false, borrowerName: borrower });
    alert("Peminjaman berhasil");
    genericModal.style.display = "none";
  };
  modalCloseBtn.onclick = () => genericModal.style.display = "none";
}

async function renderManageMembers() {
  contentPanel.innerHTML = `<div><button class="btn-primary" id="addMemberBtn">+ Tambah Anggota</button><div id="membersList"></div></div>`;
  const membersDiv = document.getElementById("membersList");
  const q = query(usersCol, where("role", "==", "anggota"));
  const unsubscribe = onSnapshot(q, (snap) => {
    members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    membersDiv.innerHTML = `
      <table style="margin-top:1rem">
        <thead><tr><th>Username</th><th>Nama Lengkap</th><th>Email</th><th>Aksi</th></tr></thead>
        <tbody>${members.map(m => `
          <tr>
            <td>${escapeHtml(m.username)}</td>
            <td>${escapeHtml(m.fullname || '')}</td>
            <td>${escapeHtml(m.email)}</td>
            <td><button class="editMemberBtn" data-id="${m.id}" style="background:#ffedd5; border:none; padding:4px 10px; border-radius:1rem;">Edit</button> <button class="deleteMemberBtn" data-id="${m.id}" data-email="${m.email}" style="background:#fee2e2; border:none; padding:4px 10px; border-radius:1rem;">Hapus</button></td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
    document.querySelectorAll(".editMemberBtn").forEach(btn => btn.addEventListener("click", () => openMemberModal(btn.dataset.id)));
    document.querySelectorAll(".deleteMemberBtn").forEach(btn => btn.addEventListener("click", async () => {
      if(confirm("Hapus anggota?")) {
        await deleteDoc(doc(db, "users", btn.dataset.id));
        alert("Anggota dihapus dari database.");
      }
    }));
  });
  document.getElementById("addMemberBtn").onclick = () => openMemberModal(null);
}

async function openMemberModal(memberId) {
  const member = memberId ? members.find(m => m.id === memberId) : null;
  modalTitle.innerText = member ? "Edit Anggota" : "Tambah Anggota";
  modalBody.innerHTML = `
    <input id="memberUsername" placeholder="Username" value="${member ? escapeHtml(member.username) : ''}" ${member ? 'readonly' : ''}>
    <input id="memberFullname" placeholder="Nama Lengkap" value="${member ? escapeHtml(member.fullname || '') : ''}">
    <input id="memberEmail" placeholder="Email" value="${member ? escapeHtml(member.email) : ''}" ${member ? 'readonly' : ''}>
    <input id="memberPassword" placeholder="Password" type="password" ${member ? 'placeholder="Kosongkan jika tidak diubah"' : ''}>
  `;
  genericModal.style.display = "flex";
  modalSaveBtn.onclick = async () => {
    const username = document.getElementById("memberUsername").value.trim();
    const fullname = document.getElementById("memberFullname").value.trim();
    const email = document.getElementById("memberEmail").value.trim();
    const password = document.getElementById("memberPassword").value;
    if (!username || !fullname || !email) return alert("Isi semua data");
    if (memberId) {
      await updateDoc(doc(db, "users", memberId), { fullname, email });
      if (password) alert("Ubah password tidak dapat dari sini.");
    } else {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCred.user.uid), { username, fullname, email, role: "anggota" });
        alert("Anggota berhasil ditambahkan");
      } catch(err) { alert("Gagal: " + err.message); }
    }
    genericModal.style.display = "none";
  };
  modalCloseBtn.onclick = () => genericModal.style.display = "none";
}

// ======================= DASHBOARD ANGGOTA =======================
function renderAnggotaDashboard() {
  const menus = [
    { id: "pinjam", label: "📖 Peminjaman Buku", icon: "fas fa-hand-holding-heart" },
    { id: "kembali", label: "🔄 Pengembalian", icon: "fas fa-undo-alt" }
  ];
  menuContainer.innerHTML = menus.map(m => `<div class="menu-card" data-menu="${m.id}"><i class="${m.icon}"></i><h4>${m.label}</h4></div>`).join('');
  document.querySelectorAll(".menu-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".menu-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      if (card.dataset.menu === "pinjam") renderAnggotaPinjam();
      else renderAnggotaKembali();
    });
  });
  document.querySelector(".menu-card").click();
}

async function renderAnggotaPinjam() {
  contentPanel.innerHTML = `<h3>📖 Daftar Buku Tersedia</h3><input type="text" id="searchAnggotaPinjam" placeholder="Cari buku" style="margin-bottom:1rem; padding:0.5rem; border-radius:2rem; border:1px solid #ccc; width:100%;"><div id="availableBooksAnggota"></div>`;
  const booksDiv = document.getElementById("availableBooksAnggota");
  const search = document.getElementById("searchAnggotaPinjam");
  const unsubscribe = onSnapshot(query(booksCol, orderBy("title")), (snap) => {
    let allBooks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    let available = allBooks.filter(b => b.isAvailable);
    const term = search ? search.value.toLowerCase() : "";
    if (term) available = available.filter(b => b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term));
    booksDiv.innerHTML = `<div class="books-grid">${available.map(book => `
      <div class="book-card">
        <strong>${escapeHtml(book.title)}</strong><br>${escapeHtml(book.author)} (${book.year})<br>
        <button class="pinjamBtn" data-id="${book.id}" data-title="${escapeHtml(book.title)}" style="margin-top:8px; background:#ff8c00; border:none; padding:6px 12px; border-radius:2rem; color:white;">Pinjam</button>
      </div>
    `).join('')}</div>`;
    document.querySelectorAll(".pinjamBtn").forEach(btn => btn.addEventListener("click", () => openAnggotaBorrowModal(btn.dataset.id, btn.dataset.title)));
  });
  if (search) search.addEventListener("input", () => {});
}

function openAnggotaBorrowModal(bookId, bookTitle) {
  modalTitle.innerText = "Konfirmasi Peminjaman";
  modalBody.innerHTML = `
    <p>Buku: <strong>${bookTitle}</strong></p>
    <input type="text" id="borrowDateAnggota" placeholder="Tanggal Pinjam">
    <input type="text" id="dueDateAnggota" placeholder="Jatuh Tempo">
  `;
  flatpickr("#borrowDateAnggota", { dateFormat: "Y-m-d", defaultDate: new Date() });
  flatpickr("#dueDateAnggota", { dateFormat: "Y-m-d", defaultDate: new Date(Date.now() + 7*86400000) });
  genericModal.style.display = "flex";
  modalSaveBtn.onclick = async () => {
    const borrowDate = document.getElementById("borrowDateAnggota").value;
    const dueDate = document.getElementById("dueDateAnggota").value;
    if (!borrowDate || !dueDate) return alert("Tanggal harus diisi");
    const book = books.find(b => b.id === bookId);
    if (!book || !book.isAvailable) return alert("Buku tidak tersedia");
    await addDoc(loansCol, {
      bookId, bookTitle: book.title, borrowerName: currentUserData.username, borrowerEmail: currentUser.email,
      borrowDate, dueDate, returnDate: null, fine: 0, status: "borrowed"
    });
    await updateDoc(doc(db, "books", bookId), { isAvailable: false, borrowerName: currentUserData.username });
    alert("Buku berhasil dipinjam");
    genericModal.style.display = "none";
    renderAnggotaPinjam();
  };
  modalCloseBtn.onclick = () => genericModal.style.display = "none";
}

async function renderAnggotaKembali() {
  contentPanel.innerHTML = `<h3>📘 Buku yang Sedang Dipinjam</h3><div id="loansAnggota"></div>`;
  const loansDiv = document.getElementById("loansAnggota");
  const q = query(loansCol, where("borrowerEmail", "==", currentUser.email), orderBy("borrowDate", "desc"));
  const unsubscribe = onSnapshot(q, (snap) => {
    const myLoans = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => !l.returnDate);
    loansDiv.innerHTML = `
      <table>
        <thead><tr><th>Buku</th><th>Tgl Pinjam</th><th>Jatuh Tempo</th><th>Denda</th><th>Aksi</th></tr></thead>
        <tbody>${myLoans.map(loan => {
          const due = new Date(loan.dueDate);
          const today = new Date();
          let fine = today > due ? "<span class='fine-badge'>Rp10.000</span>" : "-";
          return `<tr>
            <td>${escapeHtml(loan.bookTitle)}</td>
            <td>${loan.borrowDate}</td>
            <td>${loan.dueDate}</td>
            <td>${fine}</td>
            <td><button class="returnAnggotaBtn" data-id="${loan.id}" data-bookid="${loan.bookId}" style="background:#ff8c00; border:none; padding:4px 12px; border-radius:2rem; color:white;">Kembalikan</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    `;
    document.querySelectorAll(".returnAnggotaBtn").forEach(btn => btn.addEventListener("click", async () => {
      await returnBook(btn.dataset.id, btn.dataset.bookid);
      renderAnggotaKembali();
      renderAnggotaPinjam();
    }));
  });
}

// ======================= AUTH STATE =======================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      currentUserData = userDoc.data();
      currentRole = currentUserData.role;
      userNameDisplay.innerText = currentUserData.username;
      userRoleDisplay.innerText = currentRole === "admin" ? "Administrator" : "Anggota";
      currentUser = user;
      authContainer.style.display = "none";
      dashboardContainer.style.display = "block";
      if (currentRole === "admin") renderAdminDashboard();
      else renderAnggotaDashboard();
    } else {
      await signOut(auth);
      alert("Akun tidak valid, silakan registrasi ulang.");
    }
  } else {
    authContainer.style.display = "flex";
    dashboardContainer.style.display = "none";
    currentUser = null;
    currentRole = null;
    authInfo.innerText = "Pastikan metode login Email/Password sudah diaktifkan di Firebase Console.";
  }
});

// Toggle Login/Register
const modeTabs = document.querySelectorAll(".mode-tab");
modeTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    modeTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const mode = tab.dataset.mode;
    if (mode === "login") {
      loginForm.style.display = "block";
      registerForm.style.display = "none";
    } else {
      loginForm.style.display = "none";
      registerForm.style.display = "block";
    }
    authError.innerText = "";
  });
});

document.querySelectorAll("input[name='loginRole']").forEach(radio => {
  radio.addEventListener("change", (e) => { selectedLoginRole = e.target.value; });
});

authSubmitBtn.addEventListener("click", async () => {
  const username = loginUsername.value.trim();
  const password = loginPassword.value;
  if (!username || !password) return authError.innerText = "Isi username & password";
  try {
    await loginWithUsername(username, password, selectedLoginRole);
  } catch (err) {
    authError.innerText = err.message;
  }
});

registerBtn.addEventListener("click", async () => {
  const username = regUsername.value.trim();
  const fullname = regFullname.value.trim();
  const email = regEmail.value.trim();
  const password = regPassword.value;
  const confirm = regConfirmPassword.value;
  const role = document.querySelector("input[name='regRole']:checked").value;
  if (!username || !fullname || !email || !password) return authError.innerText = "Semua field harus diisi";
  if (password !== confirm) return authError.innerText = "Password tidak cocok";
  try {
    await registerUser(username, fullname, email, password, role);
    authError.innerText = "Pendaftaran berhasil! Silakan login.";
    modeTabs[0].click();
    regUsername.value = "";
    regFullname.value = "";
    regEmail.value = "";
    regPassword.value = "";
    regConfirmPassword.value = "";
  } catch (err) {
    authError.innerText = err.message;
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));
backToLoginBtn.addEventListener("click", () => signOut(auth));