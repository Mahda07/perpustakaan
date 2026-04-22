// main.js - Aplikasi Perpustakaan Offline dengan SQLite (sql.js)
let db = null;
let currentUser = null;
let currentUserData = null;
let currentRole = null;

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

// Helper: simple hash (bukan untuk produksi, hanya offline)
function hashPassword(pwd) {
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) {
    hash = ((hash << 5) - hash) + pwd.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
}

// Inisialisasi database dari localStorage atau baru
async function initDB() {
  return new Promise((resolve, reject) => {
    const saved = localStorage.getItem("pustaka_db");
    const config = {
      locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${filename}`
    };
    initSqlJs(config).then(SQL => {
      if (saved) {
        const buffer = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
        db = new SQL.Database(buffer);
      } else {
        db = new SQL.Database();
      }
      // Buat tabel jika belum ada
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        fullname TEXT,
        email TEXT UNIQUE,
        password TEXT,
        role TEXT
      )`);
      db.run(`CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        author TEXT,
        year INTEGER,
        isAvailable INTEGER DEFAULT 1,
        borrowerName TEXT DEFAULT ''
      )`);
      db.run(`CREATE TABLE IF NOT EXISTS borrowings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bookId INTEGER,
        bookTitle TEXT,
        borrowerName TEXT,
        borrowerEmail TEXT,
        borrowDate TEXT,
        dueDate TEXT,
        returnDate TEXT,
        fine INTEGER DEFAULT 0,
        status TEXT DEFAULT 'borrowed'
      )`);
      
      // Cek apakah ada admin, jika tidak buat default (admin/admin123)
      const adminCheck = db.exec("SELECT * FROM users WHERE role = 'admin'");
      if (adminCheck.length === 0 || adminCheck[0].values.length === 0) {
        const hashed = hashPassword("admin123");
        db.run(`INSERT INTO users (username, fullname, email, password, role) VALUES (?, ?, ?, ?, ?)`,
          ["admin", "Administrator", "admin@library.com", hashed, "admin"]);
      }
      resolve();
    }).catch(reject);
  });
}

// Simpan database ke localStorage
function saveDB() {
  const data = db.export();
  const str = btoa(String.fromCharCode(...data));
  localStorage.setItem("pustaka_db", str);
}

// Helper query
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result = [];
  while (stmt.step()) result.push(stmt.getAsObject());
  stmt.free();
  return result;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

// ======================= AUTH =======================
async function registerUser(username, fullname, email, password, role) {
  const existing = query("SELECT * FROM users WHERE username = ? OR email = ?", [username, email]);
  if (existing.length > 0) throw new Error("Username atau email sudah digunakan");
  if (role === "admin") {
    const adminExist = query("SELECT * FROM users WHERE role = 'admin'");
    if (adminExist.length > 0) throw new Error("Admin sudah ada, tidak bisa mendaftar admin lagi");
  }
  const hashed = hashPassword(password);
  run(`INSERT INTO users (username, fullname, email, password, role) VALUES (?, ?, ?, ?, ?)`,
    [username, fullname, email, hashed, role]);
  return true;
}

async function loginWithUsername(username, password, role) {
  const users = query("SELECT * FROM users WHERE username = ? AND role = ?", [username, role]);
  if (users.length === 0) throw new Error("Username atau role tidak ditemukan");
  const user = users[0];
  if (user.password !== hashPassword(password)) throw new Error("Password salah");
  return user;
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
  // Tambahkan tombol ekspor di panel atas
  const exportBtn = document.createElement('button');
  exportBtn.className = "btn-primary";
  exportBtn.innerHTML = '<i class="fas fa-download"></i> Ekspor Database (.sql)';
  exportBtn.style.marginBottom = "1rem";
  exportBtn.onclick = exportSQL;
  contentPanel.innerHTML = '';
  contentPanel.appendChild(exportBtn);
  document.querySelector(".menu-card").click();
}

function renderManageBooks() {
  const div = document.createElement('div');
  div.innerHTML = `<button class="btn-primary" id="addBookBtn">+ Tambah Buku</button><div id="booksListAdmin"></div>`;
  contentPanel.appendChild(div);
  const booksDiv = document.getElementById("booksListAdmin");
  function refreshBooks() {
    const books = query("SELECT * FROM books ORDER BY title");
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
    document.querySelectorAll(".editBookBtn").forEach(btn => btn.addEventListener("click", () => openBookModal(parseInt(btn.dataset.id))));
    document.querySelectorAll(".deleteBookBtn").forEach(btn => btn.addEventListener("click", async () => { if(confirm("Hapus buku?")) { run("DELETE FROM books WHERE id = ?", [parseInt(btn.dataset.id)]); refreshBooks(); } }));
  }
  refreshBooks();
  document.getElementById("addBookBtn").onclick = () => openBookModal(null);
}

function openBookModal(bookId) {
  let book = null;
  if (bookId) {
    const res = query("SELECT * FROM books WHERE id = ?", [bookId]);
    if (res.length) book = res[0];
  }
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
      run("UPDATE books SET title = ?, author = ?, year = ? WHERE id = ?", [title, author, year, bookId]);
    } else {
      run("INSERT INTO books (title, author, year, isAvailable) VALUES (?, ?, ?, 1)", [title, author, year]);
    }
    genericModal.style.display = "none";
    renderManageBooks();
  };
  modalSaveBtn.onclick = saveHandler;
  modalCloseBtn.onclick = () => genericModal.style.display = "none";
}

function renderManageTransactions() {
  const div = document.createElement('div');
  div.innerHTML = `<button class="btn-primary" id="addTransactionBtn">+ Pinjam Buku (Manual)</button><input type="text" id="searchTrans" placeholder="Cari peminjam/buku" style="margin-left:1rem; padding:0.3rem; border-radius:2rem; border:1px solid #ccc;"><div id="transactionsList"></div>`;
  contentPanel.appendChild(div);
  const transDiv = document.getElementById("transactionsList");
  const searchInput = document.getElementById("searchTrans");
  function refreshTransactions() {
    let loans = query("SELECT * FROM borrowings ORDER BY borrowDate DESC");
    let term = searchInput ? searchInput.value.toLowerCase() : "";
    if (term) {
      loans = loans.filter(l => l.borrowerName.toLowerCase().includes(term) || (l.bookTitle || "").toLowerCase().includes(term));
    }
    transDiv.innerHTML = `
      <table style="margin-top:1rem">
        <thead><tr><th>Buku</th><th>Peminjam</th><th>Tgl Pinjam</th><th>Jatuh Tempo</th><th>Status</th><th>Denda</th><th>Aksi</th></tr></thead>
        <tbody>${loans.map(loan => {
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
    document.querySelectorAll(".returnTransBtn").forEach(btn => btn.addEventListener("click", async () => { await returnBook(parseInt(btn.dataset.id), parseInt(btn.dataset.bookid)); refreshTransactions(); }));
    document.querySelectorAll(".deleteTransBtn").forEach(btn => btn.addEventListener("click", async () => { if(confirm("Hapus transaksi?")) { run("DELETE FROM borrowings WHERE id = ?", [parseInt(btn.dataset.id)]); refreshTransactions(); } }));
  }
  refreshTransactions();
  if (searchInput) searchInput.addEventListener("input", refreshTransactions);
  document.getElementById("addTransactionBtn").onclick = () => openManualBorrowModal();
}

async function returnBook(loanId, bookId) {
  const loan = query("SELECT * FROM borrowings WHERE id = ?", [loanId])[0];
  if (!loan) return;
  if (loan.returnDate) return alert("Sudah dikembalikan");
  const due = new Date(loan.dueDate);
  const today = new Date();
  let fine = today > due ? 10000 : 0;
  if (confirm(fine ? `Terlambat! Denda Rp10.000. Lanjutkan?` : "Kembalikan buku?")) {
    run("UPDATE borrowings SET returnDate = ?, fine = ? WHERE id = ?", [new Date().toISOString().split('T')[0], fine, loanId]);
    run("UPDATE books SET isAvailable = 1, borrowerName = '' WHERE id = ?", [bookId]);
    alert("Buku dikembalikan");
  }
}

function openManualBorrowModal() {
  const books = query("SELECT * FROM books WHERE isAvailable = 1");
  modalTitle.innerText = "Pinjam Buku (Manual)";
  modalBody.innerHTML = `
    <select id="bookSelect"><option value="">Pilih Buku</option>${books.map(b => `<option value="${b.id}">${escapeHtml(b.title)}</option>`).join('')}</select>
    <input id="borrowerName" placeholder="Nama Peminjam">
    <input type="text" id="borrowDate" placeholder="Tanggal Pinjam">
    <input type="text" id="dueDate" placeholder="Jatuh Tempo">
  `;
  flatpickr("#borrowDate", { dateFormat: "Y-m-d", defaultDate: new Date() });
  flatpickr("#dueDate", { dateFormat: "Y-m-d", defaultDate: new Date(Date.now() + 7*86400000) });
  genericModal.style.display = "flex";
  modalSaveBtn.onclick = async () => {
    const bookId = parseInt(document.getElementById("bookSelect").value);
    const borrower = document.getElementById("borrowerName").value.trim();
    const borrowDate = document.getElementById("borrowDate").value;
    const dueDate = document.getElementById("dueDate").value;
    if (!bookId || !borrower || !borrowDate || !dueDate) return alert("Lengkapi data");
    const book = query("SELECT * FROM books WHERE id = ?", [bookId])[0];
    if (!book || !book.isAvailable) return alert("Buku tidak tersedia");
    run(`INSERT INTO borrowings (bookId, bookTitle, borrowerName, borrowerEmail, borrowDate, dueDate, returnDate, fine, status) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, 'borrowed')`,
      [bookId, book.title, borrower, "", borrowDate, dueDate]);
    run("UPDATE books SET isAvailable = 0, borrowerName = ? WHERE id = ?", [borrower, bookId]);
    alert("Peminjaman berhasil");
    genericModal.style.display = "none";
    renderManageTransactions();
  };
  modalCloseBtn.onclick = () => genericModal.style.display = "none";
}

function renderManageMembers() {
  const div = document.createElement('div');
  div.innerHTML = `<button class="btn-primary" id="addMemberBtn">+ Tambah Anggota</button><div id="membersList"></div>`;
  contentPanel.appendChild(div);
  const membersDiv = document.getElementById("membersList");
  function refreshMembers() {
    const members = query("SELECT * FROM users WHERE role = 'anggota'");
    membersDiv.innerHTML = `
      <table style="margin-top:1rem">
        <thead><tr><th>Username</th><th>Nama Lengkap</th><th>Email</th><th>Aksi</th></tr></thead>
        <tbody>${members.map(m => `
          <tr>
            <td>${escapeHtml(m.username)}</td>
            <td>${escapeHtml(m.fullname || '')}</td>
            <td>${escapeHtml(m.email)}</td>
            <td><button class="editMemberBtn" data-id="${m.id}" style="background:#ffedd5; border:none; padding:4px 10px; border-radius:1rem;">Edit</button> <button class="deleteMemberBtn" data-id="${m.id}" style="background:#fee2e2; border:none; padding:4px 10px; border-radius:1rem;">Hapus</button></td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
    document.querySelectorAll(".editMemberBtn").forEach(btn => btn.addEventListener("click", () => openMemberModal(parseInt(btn.dataset.id))));
    document.querySelectorAll(".deleteMemberBtn").forEach(btn => btn.addEventListener("click", async () => {
      if(confirm("Hapus anggota?")) {
        run("DELETE FROM users WHERE id = ?", [parseInt(btn.dataset.id)]);
        refreshMembers();
      }
    }));
  }
  refreshMembers();
  document.getElementById("addMemberBtn").onclick = () => openMemberModal(null);
}

function openMemberModal(memberId) {
  let member = null;
  if (memberId) {
    const res = query("SELECT * FROM users WHERE id = ?", [memberId]);
    if (res.length) member = res[0];
  }
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
      run("UPDATE users SET fullname = ?, email = ? WHERE id = ?", [fullname, email, memberId]);
      if (password) {
        const hashed = hashPassword(password);
        run("UPDATE users SET password = ? WHERE id = ?", [hashed, memberId]);
      }
    } else {
      const hashed = hashPassword(password);
      try {
        run(`INSERT INTO users (username, fullname, email, password, role) VALUES (?, ?, ?, ?, 'anggota')`, [username, fullname, email, hashed]);
      } catch(e) { alert("Gagal: " + e.message); }
    }
    genericModal.style.display = "none";
    renderManageMembers();
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

function renderAnggotaPinjam() {
  const div = document.createElement('div');
  div.innerHTML = `<h3>📖 Daftar Buku Tersedia</h3><input type="text" id="searchAnggotaPinjam" placeholder="Cari buku" style="margin-bottom:1rem; padding:0.5rem; border-radius:2rem; border:1px solid #ccc; width:100%;"><div id="availableBooksAnggota"></div>`;
  contentPanel.innerHTML = '';
  contentPanel.appendChild(div);
  const booksDiv = document.getElementById("availableBooksAnggota");
  const search = document.getElementById("searchAnggotaPinjam");
  function refreshBooks() {
    let books = query("SELECT * FROM books WHERE isAvailable = 1 ORDER BY title");
    const term = search ? search.value.toLowerCase() : "";
    if (term) books = books.filter(b => b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term));
    booksDiv.innerHTML = `<div class="books-grid">${books.map(book => `
      <div class="book-card">
        <strong>${escapeHtml(book.title)}</strong><br>${escapeHtml(book.author)} (${book.year})<br>
        <button class="pinjamBtn" data-id="${book.id}" data-title="${escapeHtml(book.title)}" style="margin-top:8px; background:#ff8c00; border:none; padding:6px 12px; border-radius:2rem; color:white;">Pinjam</button>
      </div>
    `).join('')}</div>`;
    document.querySelectorAll(".pinjamBtn").forEach(btn => btn.addEventListener("click", () => openAnggotaBorrowModal(parseInt(btn.dataset.id), btn.dataset.title)));
  }
  refreshBooks();
  if (search) search.addEventListener("input", refreshBooks);
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
    const book = query("SELECT * FROM books WHERE id = ?", [bookId])[0];
    if (!book || !book.isAvailable) return alert("Buku tidak tersedia");
    run(`INSERT INTO borrowings (bookId, bookTitle, borrowerName, borrowerEmail, borrowDate, dueDate, returnDate, fine, status) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, 'borrowed')`,
      [bookId, book.title, currentUserData.username, currentUserData.email, borrowDate, dueDate]);
    run("UPDATE books SET isAvailable = 0, borrowerName = ? WHERE id = ?", [currentUserData.username, bookId]);
    alert("Buku berhasil dipinjam");
    genericModal.style.display = "none";
    renderAnggotaPinjam();
  };
  modalCloseBtn.onclick = () => genericModal.style.display = "none";
}

function renderAnggotaKembali() {
  const div = document.createElement('div');
  div.innerHTML = `<h3>📘 Buku yang Sedang Dipinjam</h3><div id="loansAnggota"></div>`;
  contentPanel.innerHTML = '';
  contentPanel.appendChild(div);
  const loansDiv = document.getElementById("loansAnggota");
  function refreshLoans() {
    const loans = query("SELECT * FROM borrowings WHERE borrowerEmail = ? AND returnDate IS NULL ORDER BY borrowDate DESC", [currentUserData.email]);
    loansDiv.innerHTML = `
      <table>
        <thead><tr><th>Buku</th><th>Tgl Pinjam</th><th>Jatuh Tempo</th><th>Denda</th><th>Aksi</th></tr></thead>
        <tbody>${loans.map(loan => {
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
      await returnBook(parseInt(btn.dataset.id), parseInt(btn.dataset.bookid));
      refreshLoans();
      renderAnggotaPinjam();
    }));
  }
  refreshLoans();
}

// ======================= EKSPOR DATABASE KE .SQL =======================
function exportSQL() {
  const tables = ["users", "books", "borrowings"];
  let sqlDump = "";
  for (const table of tables) {
    const rows = query(`SELECT * FROM ${table}`);
    if (rows.length === 0) continue;
    const columns = Object.keys(rows[0]);
    sqlDump += `-- Table: ${table}\n`;
    sqlDump += `DROP TABLE IF EXISTS ${table};\n`;
    const createStmt = db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`);
    if (createStmt.length && createStmt[0].values.length) {
      sqlDump += createStmt[0].values[0][0] + ";\n";
    }
    for (const row of rows) {
      const values = columns.map(col => {
        let val = row[col];
        if (val === null || val === undefined) return "NULL";
        if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
        return val;
      });
      sqlDump += `INSERT INTO ${table} (${columns.join(",")}) VALUES (${values.join(",")});\n`;
    }
    sqlDump += "\n";
  }
  const blob = new Blob([sqlDump], {type: "application/sql"});
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "pustaka_database.sql";
  link.click();
  URL.revokeObjectURL(link.href);
}

// ======================= AUTH STATE & STARTUP =======================
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]); }

async function startApp() {
  await initDB();
  // Tampilkan login jika belum login
  const loggedUser = localStorage.getItem("current_user");
  if (loggedUser) {
    try {
      const user = JSON.parse(loggedUser);
      const verify = query("SELECT * FROM users WHERE id = ?", [user.id]);
      if (verify.length && verify[0].password === user.password) {
        currentUser = { email: verify[0].email, uid: verify[0].id };
        currentUserData = verify[0];
        currentRole = currentUserData.role;
        userNameDisplay.innerText = currentUserData.username;
        userRoleDisplay.innerText = currentRole === "admin" ? "Administrator" : "Anggota";
        authContainer.style.display = "none";
        dashboardContainer.style.display = "block";
        if (currentRole === "admin") renderAdminDashboard();
        else renderAnggotaDashboard();
        return;
      }
    } catch(e) {}
  }
  authContainer.style.display = "flex";
  dashboardContainer.style.display = "none";
  authInfo.innerText = "Aplikasi berjalan offline sepenuhnya dengan SQLite.";
}

// Login / Register Events
modeTabs = document.querySelectorAll(".mode-tab");
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
    const user = await loginWithUsername(username, password, selectedLoginRole);
    currentUser = { email: user.email, uid: user.id };
    currentUserData = user;
    currentRole = user.role;
    localStorage.setItem("current_user", JSON.stringify({ id: user.id, password: user.password }));
    userNameDisplay.innerText = user.username;
    userRoleDisplay.innerText = user.role === "admin" ? "Administrator" : "Anggota";
    authContainer.style.display = "none";
    dashboardContainer.style.display = "block";
    if (user.role === "admin") renderAdminDashboard();
    else renderAnggotaDashboard();
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

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("current_user");
  authContainer.style.display = "flex";
  dashboardContainer.style.display = "none";
  currentUser = null;
});
backToLoginBtn.addEventListener("click", () => {
  localStorage.removeItem("current_user");
  authContainer.style.display = "flex";
  dashboardContainer.style.display = "none";
});

startApp();