import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, query, where, orderBy, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updatePassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

let currentUser = null, currentRole = null, currentUserData = null;
let books = [], loans = [], members = [];

// DOM elements
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
const regKelas = document.getElementById("regKelas");
const regPassword = document.getElementById("regPassword");
const regConfirmPassword = document.getElementById("regConfirmPassword");
const authError = document.getElementById("authError");
const authInfo = document.getElementById("authInfo");
const userNameDisplay = document.getElementById("userNameDisplay");
const userRoleDisplay = document.getElementById("userRoleDisplay");
const userKelasDisplay = document.getElementById("userKelasDisplay");
const logoutBtn = document.getElementById("logoutBtn");
const backToLoginBtn = document.getElementById("backToLoginBtn");
const menuContainer = document.getElementById("menuContainer");
const contentPanel = document.getElementById("contentPanel");
const genericModal = document.getElementById("genericModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalSaveBtn = document.getElementById("modalSaveBtn");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const changePasswordBtn = document.getElementById("changePasswordBtn");

let selectedLoginRole = "admin";

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}

// Toggle password visibility
document.querySelectorAll('.toggle-password').forEach(icon => {
  icon.addEventListener('click', () => {
    const target = document.getElementById(icon.dataset.target);
    if (target.type === 'password') {
      target.type = 'text';
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      target.type = 'password';
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  });
});

async function ensureAdminExists() {
  const adminQuery = query(usersCol, where("role", "==", "admin"));
  const adminSnap = await getDocs(adminQuery);
  if (adminSnap.empty) {
    const adminEmail = "admin@pustaka.com";
    try {
      const userCred = await createUserWithEmailAndPassword(auth, adminEmail, "admin123");
      await setDoc(doc(db, "users", userCred.user.uid), { username: "admin", fullname: "Administrator", email: adminEmail, role: "admin", kelas: "" });
      console.log("Admin default: username admin, password admin123");
    } catch (e) {
      console.log("Admin gagal dibuat", e);
    }
  }
}

async function registerUser(username, fullname, email, password, kelas) {
  const usernameQuery = query(usersCol, where("username", "==", username));
  if (!(await getDocs(usernameQuery)).empty) throw new Error("Username sudah digunakan");
  const emailQuery = query(usersCol, where("email", "==", email));
  if (!(await getDocs(emailQuery)).empty) throw new Error("Email sudah terdaftar");
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", userCred.user.uid), { username, fullname, email, role: "anggota", kelas, createdAt: new Date() });
  return userCred.user;
}

async function loginWithUsername(username, password, role) {
  const q = query(usersCol, where("username", "==", username), where("role", "==", role));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("Username atau role tidak ditemukan");
  const userDoc = snap.docs[0];
  await signInWithEmailAndPassword(auth, userDoc.data().email, password);
  return userDoc.data();
}

async function changeUserPassword(newPassword) {
  await updatePassword(auth.currentUser, newPassword);
}

async function returnBook(loanId, bookId) {
  const loanRef = doc(db, "borrowings", loanId);
  const loanSnap = await getDoc(loanRef);
  if (!loanSnap.exists()) return;
  const loan = loanSnap.data();
  if (loan.returnDate) return alert("Sudah dikembalikan");
  const due = new Date(loan.dueDate), today = new Date();
  let fine = today > due ? 10000 : 0;
  if (confirm(fine ? `Terlambat! Denda Rp10.000. Lanjutkan?` : "Kembalikan buku?")) {
    await updateDoc(loanRef, { returnDate: new Date().toISOString().split('T')[0], fine });
    const bookRef = doc(db, "books", bookId);
    const bookSnap = await getDoc(bookRef);
    if (bookSnap.exists()) await updateDoc(bookRef, { stock: (bookSnap.data().stock || 0) + 1, isAvailable: true });
    alert("Buku dikembalikan");
  }
}

// ======================= ADMIN DASHBOARD =======================
function renderAdminDashboard() {
  menuContainer.innerHTML = [
    { id: "manageBooks", label: "📚 Kelola Buku", icon: "fas fa-book" },
    { id: "manageTransactions", label: "📋 Kelola Transaksi", icon: "fas fa-exchange-alt" },
    { id: "manageMembers", label: "👥 Kelola Anggota", icon: "fas fa-users" }
  ].map(m => `<div class="menu-card" data-menu="${m.id}"><i class="${m.icon}"></i><h4>${m.label}</h4></div>`).join('');
  document.querySelectorAll(".menu-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".menu-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      if (card.dataset.menu === "manageBooks") renderManageBooks();
      else if (card.dataset.menu === "manageTransactions") renderManageTransactions();
      else if (card.dataset.menu === "manageMembers") renderManageMembers();
    });
  });
  document.querySelector(".menu-card").click();
}

async function renderManageBooks() {
  contentPanel.innerHTML = `<div><button class="btn-primary" id="addBookBtn">+ Tambah Buku</button><div id="booksListAdmin"></div></div>`;
  const booksDiv = document.getElementById("booksListAdmin");
  onSnapshot(query(booksCol, orderBy("title")), (snap) => {
    books = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    booksDiv.innerHTML = `<table><thead><tr><th>Judul</th><th>Penulis</th><th>Tahun</th><th>Stok</th><th>Aksi</th></tr></thead>
      <tbody>${books.map(book => `<tr>
        <td>${escapeHtml(book.title)}</td><td>${escapeHtml(book.author)}</td><td>${book.year}</td>
        <td>${book.stock || 0}</td>
        <td><button class="editBookBtn" data-id="${book.id}">Edit</button> <button class="deleteBookBtn" data-id="${book.id}">Hapus</button></td>
      </tr>`).join('')}</tbody></table>`;
    document.querySelectorAll(".editBookBtn").forEach(btn => btn.addEventListener("click", () => openBookModal(btn.dataset.id)));
    document.querySelectorAll(".deleteBookBtn").forEach(btn => btn.addEventListener("click", async () => { if (confirm("Hapus buku?")) await deleteDoc(doc(db, "books", btn.dataset.id)); }));
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
    <input id="bookStock" placeholder="Stok" type="number" value="${book ? (book.stock || 0) : 0}">
  `;
  genericModal.style.display = "flex";
  modalSaveBtn.onclick = async () => {
    const title = document.getElementById("bookTitle").value.trim();
    const author = document.getElementById("bookAuthor").value.trim();
    const year = parseInt(document.getElementById("bookYear").value);
    const stock = parseInt(document.getElementById("bookStock").value);
    if (!title || !author || !year || isNaN(stock)) return alert("Isi semua data");
    if (bookId) await updateDoc(doc(db, "books", bookId), { title, author, year, stock });
    else await addDoc(booksCol, { title, author, year, stock, isAvailable: stock > 0 });
    genericModal.style.display = "none";
  };
  modalCloseBtn.onclick = () => genericModal.style.display = "none";
}

async function renderManageTransactions() {
  contentPanel.innerHTML = `<div><button class="btn-primary" id="addTransactionBtn">+ Pinjam Buku (Manual)</button><input type="text" id="searchTrans" placeholder="Cari peminjam/buku" style="margin-left:1rem;"><div id="transactionsList"></div></div>`;
  const transDiv = document.getElementById("transactionsList");
  const searchInput = document.getElementById("searchTrans");
  onSnapshot(query(loansCol, orderBy("borrowDate", "desc")), (snap) => {
    loans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    let filtered = loans;
    if (searchInput?.value) filtered = loans.filter(l => l.borrowerName.toLowerCase().includes(searchInput.value.toLowerCase()) || (l.bookTitle || "").toLowerCase().includes(searchInput.value.toLowerCase()));
    transDiv.innerHTML = `<table><thead><tr><th>Buku</th><th>Peminjam</th><th>Kelas</th><th>Tgl Pinjam</th><th>Jatuh Tempo</th><th>Status</th><th>Denda</th><th>Aksi</th></tr></thead>
      <tbody>${filtered.map(loan => {
        const isReturned = !!loan.returnDate;
        let fineDisplay = "-";
        if (!isReturned) { const today = new Date(), due = new Date(loan.dueDate); if (today > due) fineDisplay = "<span class='fine-badge'>Rp10.000</span>"; }
        else if (loan.fine) fineDisplay = `<span class='fine-badge'>Rp${loan.fine}</span>`;
        return `<tr>
          <td>${escapeHtml(loan.bookTitle)}</td><td>${escapeHtml(loan.borrowerName)}</td><td>${escapeHtml(loan.kelas || '-')}</td>
          <td>${loan.borrowDate}</td><td>${loan.dueDate}</td><td>${isReturned ? "Dikembalikan" : "Dipinjam"}</td>
          <td>${fineDisplay}</td>
          <td>${!isReturned ? `<button class="returnTransBtn" data-id="${loan.id}" data-bookid="${loan.bookId}">Kembalikan</button>` : ''} <button class="deleteTransBtn" data-id="${loan.id}">Hapus</button></td>
        </tr>`;
      }).join('')}</tbody></table>`;
    document.querySelectorAll(".returnTransBtn").forEach(btn => btn.addEventListener("click", async () => { await returnBook(btn.dataset.id, btn.dataset.bookid); }));
    document.querySelectorAll(".deleteTransBtn").forEach(btn => btn.addEventListener("click", async () => { if (confirm("Hapus transaksi?")) await deleteDoc(doc(db, "borrowings", btn.dataset.id)); }));
  });
  if (searchInput) searchInput.addEventListener("input", () => {});
  document.getElementById("addTransactionBtn").onclick = () => openManualBorrowModal();
}

function openManualBorrowModal() {
  modalTitle.innerText = "Pinjam Buku (Manual)";
  const availableBooks = books.filter(b => (b.stock || 0) > 0);
  modalBody.innerHTML = `
    <select id="bookSelect"><option value="">Pilih Buku</option>${availableBooks.map(b => `<option value="${b.id}">${escapeHtml(b.title)} (stok: ${b.stock})</option>`).join('')}</select>
    <input id="borrowerName" placeholder="Nama Peminjam">
    <input id="borrowerKelas" placeholder="Kelas">
    <input type="text" id="borrowDate" placeholder="Tanggal Pinjam">
    <input type="text" id="dueDate" placeholder="Jatuh Tempo">
  `;
  flatpickr("#borrowDate", { dateFormat: "Y-m-d", defaultDate: new Date() });
  flatpickr("#dueDate", { dateFormat: "Y-m-d", defaultDate: new Date(Date.now() + 7 * 86400000) });
  genericModal.style.display = "flex";
  modalSaveBtn.onclick = async () => {
    const bookId = document.getElementById("bookSelect").value;
    const borrower = document.getElementById("borrowerName").value.trim();
    const kelas = document.getElementById("borrowerKelas").value.trim();
    const borrowDate = document.getElementById("borrowDate").value;
    const dueDate = document.getElementById("dueDate").value;
    if (!bookId || !borrower || !borrowDate || !dueDate) return alert("Lengkapi data");
    const book = books.find(b => b.id === bookId);
    if (!book || (book.stock || 0) <= 0) return alert("Stok buku habis");
    await addDoc(loansCol, { bookId, bookTitle: book.title, borrowerName: borrower, kelas, borrowerEmail: "", borrowDate, dueDate, returnDate: null, fine: 0 });
    await updateDoc(doc(db, "books", bookId), { stock: (book.stock || 0) - 1, isAvailable: (book.stock - 1) > 0 });
    alert("Peminjaman berhasil");
    genericModal.style.display = "none";
  };
  modalCloseBtn.onclick = () => genericModal.style.display = "none";
}

async function renderManageMembers() {
  contentPanel.innerHTML = `<div><button class="btn-primary" id="addMemberBtn">+ Tambah Anggota</button><div id="membersList"></div></div>`;
  const membersDiv = document.getElementById("membersList");
  const q = query(usersCol, where("role", "==", "anggota"));
  onSnapshot(q, (snap) => {
    members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    membersDiv.innerHTML = `<table><thead><tr><th>Username</th><th>Nama</th><th>Kelas</th><th>Email</th><th>Aksi</th></tr></thead>
      <tbody>${members.map(m => `<tr>
        <td>${escapeHtml(m.username)}</td><td>${escapeHtml(m.fullname)}</td><td>${escapeHtml(m.kelas || '-')}</td><td>${escapeHtml(m.email)}</td>
        <td><button class="editMemberBtn" data-id="${m.id}">Edit</button> <button class="deleteMemberBtn" data-id="${m.id}">Hapus</button></td>
      </tr>`).join('')}</tbody></table>`;
    document.querySelectorAll(".editMemberBtn").forEach(btn => btn.addEventListener("click", () => openMemberModal(btn.dataset.id)));
    document.querySelectorAll(".deleteMemberBtn").forEach(btn => btn.addEventListener("click", async () => { if (confirm("Hapus anggota?")) await deleteDoc(doc(db, "users", btn.dataset.id)); }));
  });
  document.getElementById("addMemberBtn").onclick = () => openMemberModal(null);
}

async function openMemberModal(memberId) {
  const member = memberId ? members.find(m => m.id === memberId) : null;
  modalTitle.innerText = member ? "Edit Anggota" : "Tambah Anggota";
  modalBody.innerHTML = `
    <input id="memberUsername" placeholder="Username" value="${member ? escapeHtml(member.username) : ''}" ${member ? 'readonly' : ''}>
    <input id="memberFullname" placeholder="Nama Lengkap" value="${member ? escapeHtml(member.fullname) : ''}">
    <select id="memberKelas"><option value="">Pilih Kelas</option>${["X IPA 1", "X IPA 2", "XI IPA 1", "XI IPA 2", "XII IPA 1", "XII IPA 2", "X IPS 1", "X IPS 2"].map(k => `<option ${member?.kelas === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
    <input id="memberEmail" placeholder="Email" value="${member ? escapeHtml(member.email) : ''}" ${member ? 'readonly' : ''}>
    <input id="memberPassword" placeholder="Password" type="password" ${member ? 'placeholder="Kosongkan jika tidak diubah"' : ''}>
  `;
  genericModal.style.display = "flex";
  modalSaveBtn.onclick = async () => {
    const username = document.getElementById("memberUsername").value.trim();
    const fullname = document.getElementById("memberFullname").value.trim();
    const kelas = document.getElementById("memberKelas").value;
    const email = document.getElementById("memberEmail").value.trim();
    const password = document.getElementById("memberPassword").value;
    if (!username || !fullname || !email) return alert("Isi semua data");
    if (memberId) {
      await updateDoc(doc(db, "users", memberId), { fullname, kelas, email });
      if (password) alert("Ubah password tidak bisa dari sini.");
    } else {
      if (!password) return alert("Password harus diisi");
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", userCred.user.uid), { username, fullname, email, kelas, role: "anggota" });
        alert("Anggota berhasil ditambahkan");
      } catch (err) { alert("Gagal: " + err.message); }
    }
    genericModal.style.display = "none";
  };
  modalCloseBtn.onclick = () => genericModal.style.display = "none";
}

// ======================= ANGGOTA DASHBOARD =======================
function renderAnggotaDashboard() {
  menuContainer.innerHTML = [
    { id: "pinjam", label: "📖 Peminjaman Buku", icon: "fas fa-hand-holding-heart" },
    { id: "kembali", label: "🔄 Pengembalian & Perpanjang", icon: "fas fa-undo-alt" }
  ].map(m => `<div class="menu-card" data-menu="${m.id}"><i class="${m.icon}"></i><h4>${m.label}</h4></div>`).join('');
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
  contentPanel.innerHTML = `<h3>📖 Daftar Buku Tersedia</h3><input type="text" id="searchAnggotaPinjam" placeholder="Cari buku"><div id="availableBooksAnggota"></div>`;
  const booksDiv = document.getElementById("availableBooksAnggota");
  const search = document.getElementById("searchAnggotaPinjam");
  onSnapshot(query(booksCol, orderBy("title")), (snap) => {
    let allBooks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    let available = allBooks.filter(b => (b.stock || 0) > 0);
    const term = search?.value.toLowerCase() || "";
    if (term) available = available.filter(b => b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term));
    booksDiv.innerHTML = `<div class="books-grid">${available.map(book => `
      <div class="book-card"><strong>${escapeHtml(book.title)}</strong><br>${escapeHtml(book.author)} (${book.year})<br>Stok: ${book.stock || 0}<br>
      <button class="pinjamBtn" data-id="${book.id}" data-title="${escapeHtml(book.title)}">Pinjam</button></div>
    `).join('')}</div>`;
    document.querySelectorAll(".pinjamBtn").forEach(btn => btn.addEventListener("click", () => openAnggotaBorrowModal(btn.dataset.id, btn.dataset.title)));
  });
  if (search) search.addEventListener("input", () => {});
}

function openAnggotaBorrowModal(bookId, bookTitle) {
  modalTitle.innerText = "Konfirmasi Peminjaman";
  modalBody.innerHTML = `<p>Buku: <strong>${bookTitle}</strong></p>
    <input type="text" id="borrowDateAnggota" placeholder="Tanggal Pinjam"><input type="text" id="dueDateAnggota" placeholder="Jatuh Tempo">`;
  flatpickr("#borrowDateAnggota", { dateFormat: "Y-m-d", defaultDate: new Date() });
  flatpickr("#dueDateAnggota", { dateFormat: "Y-m-d", defaultDate: new Date(Date.now() + 7 * 86400000) });
  genericModal.style.display = "flex";
  modalSaveBtn.onclick = async () => {
    const borrowDate = document.getElementById("borrowDateAnggota").value;
    const dueDate = document.getElementById("dueDateAnggota").value;
    if (!borrowDate || !dueDate) return alert("Tanggal harus diisi");
    const book = books.find(b => b.id === bookId);
    if (!book || (book.stock || 0) <= 0) return alert("Stok buku habis");
    await addDoc(loansCol, { bookId, bookTitle: book.title, borrowerName: currentUserData.username, borrowerEmail: currentUser.email, kelas: currentUserData.kelas, borrowDate, dueDate, returnDate: null, fine: 0 });
    await updateDoc(doc(db, "books", bookId), { stock: (book.stock || 0) - 1, isAvailable: (book.stock - 1) > 0 });
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
  onSnapshot(q, (snap) => {
    const myLoans = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => !l.returnDate);
    loansDiv.innerHTML = `<table><thead><tr><th>Buku</th><th>Tgl Pinjam</th><th>Jatuh Tempo</th><th>Denda</th><th>Aksi</th></tr></thead>
      <tbody>${myLoans.map(loan => {
        const due = new Date(loan.dueDate), today = new Date();
        let fine = today > due ? "<span class='fine-badge'>Rp10.000</span>" : "-";
        return `<tr>
          <td>${escapeHtml(loan.bookTitle)}</td><td>${loan.borrowDate}</td><td>${loan.dueDate}</td><td>${fine}</td>
          <td><button class="returnAnggotaBtn" data-id="${loan.id}" data-bookid="${loan.bookId}">Kembalikan</button>
          <button class="extendBtn" data-id="${loan.id}" data-due="${loan.dueDate}">Perpanjang (+7 hari)</button></td>
        </tr>`;
      }).join('')}</tbody></table>`;
    document.querySelectorAll(".returnAnggotaBtn").forEach(btn => btn.addEventListener("click", async () => { await returnBook(btn.dataset.id, btn.dataset.bookid); renderAnggotaKembali(); renderAnggotaPinjam(); }));
    document.querySelectorAll(".extendBtn").forEach(btn => btn.addEventListener("click", async () => {
      const loanId = btn.dataset.id;
      const currentDue = btn.dataset.due;
      const newDue = new Date(currentDue);
      newDue.setDate(newDue.getDate() + 7);
      const newDueStr = newDue.toISOString().split('T')[0];
      await updateDoc(doc(db, "borrowings", loanId), { dueDate: newDueStr });
      alert("Jatuh tempo diperpanjang 7 hari");
      renderAnggotaKembali();
    }));
  });
}

// Ubah Password Modal
changePasswordBtn.addEventListener("click", () => {
  modalTitle.innerText = "Ubah Password";
  modalBody.innerHTML = `<div class="password-wrapper"><input type="password" id="newPassword" placeholder="Password Baru"><i class="fas fa-eye toggle-password" data-target="newPassword"></i></div>
    <div class="password-wrapper"><input type="password" id="confirmNewPassword" placeholder="Konfirmasi Password Baru"><i class="fas fa-eye toggle-password" data-target="confirmNewPassword"></i></div>`;
  document.querySelectorAll('.toggle-password').forEach(icon => {
    icon.addEventListener('click', () => {
      const inp = document.getElementById(icon.dataset.target);
      if (inp.type === 'password') {
        inp.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        inp.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
      }
    });
  });
  genericModal.style.display = "flex";
  modalSaveBtn.onclick = async () => {
    const newPass = document.getElementById("newPassword").value;
    const confirmPass = document.getElementById("confirmNewPassword").value;
    if (!newPass) return alert("Password baru tidak boleh kosong");
    if (newPass !== confirmPass) return alert("Password tidak cocok");
    try {
      await changeUserPassword(newPass);
      alert("Password berhasil diubah");
      genericModal.style.display = "none";
    } catch (err) {
      alert("Gagal ubah password: " + err.message);
    }
  };
  modalCloseBtn.onclick = () => genericModal.style.display = "none";
});

// ======================= AUTH STATE =======================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      currentUserData = userDoc.data();
      currentRole = currentUserData.role;
      userNameDisplay.innerText = currentUserData.username;
      userRoleDisplay.innerText = currentRole === "admin" ? "Administrator" : "Anggota";
      userKelasDisplay.innerText = currentUserData.kelas ? ` - ${currentUserData.kelas}` : "";
      currentUser = user;
      authContainer.style.display = "none";
      dashboardContainer.style.display = "block";
      if (currentRole === "admin") renderAdminDashboard();
      else renderAnggotaDashboard();
    } else {
      await signOut(auth);
      alert("Akun tidak valid");
    }
  } else {
    authContainer.style.display = "flex";
    dashboardContainer.style.display = "none";
    ensureAdminExists();
    authInfo.innerText = "Login sebagai admin (username: admin, password: admin123) atau daftar anggota.";
  }
});

// Event listeners
const modeTabs = document.querySelectorAll(".mode-tab");
modeTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    modeTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    if (tab.dataset.mode === "login") {
      loginForm.style.display = "block";
      registerForm.style.display = "none";
    } else {
      loginForm.style.display = "none";
      registerForm.style.display = "block";
    }
    authError.innerText = "";
  });
});
document.querySelectorAll("input[name='loginRole']").forEach(radio => radio.addEventListener("change", e => selectedLoginRole = e.target.value));
authSubmitBtn.addEventListener("click", async () => {
  const username = loginUsername.value.trim(), password = loginPassword.value;
  if (!username || !password) return authError.innerText = "Isi username & password";
  try {
    await loginWithUsername(username, password, selectedLoginRole);
  } catch (err) {
    authError.innerText = err.message;
  }
});
registerBtn.addEventListener("click", async () => {
  const username = regUsername.value.trim(), fullname = regFullname.value.trim(), email = regEmail.value.trim(), kelas = regKelas.value, password = regPassword.value, confirm = regConfirmPassword.value;
  if (!username || !fullname || !email || !kelas || !password) return authError.innerText = "Semua field harus diisi";
  if (password !== confirm) return authError.innerText = "Password tidak cocok";
  try {
    await registerUser(username, fullname, email, password, kelas);
    authError.innerText = "Pendaftaran berhasil! Silakan login.";
    modeTabs[0].click();
    regUsername.value = regFullname.value = regEmail.value = regPassword.value = regConfirmPassword.value = "";
    regKelas.value = "";
  } catch (err) {
    authError.innerText = err.message;
  }
});
logoutBtn.addEventListener("click", () => signOut(auth));
backToLoginBtn.addEventListener("click", () => signOut(auth));