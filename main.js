import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, deleteUser } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, Timestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCfqZD7UZZt-GWmtNhfJyksrv3-8ENRjto",
    authDomain: "insan-cemerlang-d5574.firebaseapp.com",
    projectId: "insan-cemerlang-d5574",
    storageBucket: "insan-cemerlang-d5574.appspot.com",
    messagingSenderId: "1035937160050",
    appId: "1:1035937160050:web:6d77d3874c3f78b2811beb",
    measurementId: "G-EVVQ80Q08C"
};

// Initialize Firebase
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase initialized successfully");
} catch(e) {
    console.error("Firebase initialization error:", e);
    alert("Gagal init Firebase: " + e.message);
}

// Global Variables
let currentUserObj = null;
let currentUserRole = null;
let currentUserDocId = null;

// Helper Functions
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toastMsg');
    toast.innerText = msg;
    toast.classList.remove('hidden', 'bg-red-500', 'bg-green-500');
    toast.classList.add(type === 'error' ? 'bg-red-500' : 'bg-green-500');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
}

function usernameToEmail(username) {
    return username + "@pustakaapp.com";
}

// Login Function
window.loginWithUsername = async (roleType) => {
    let username, password;
    if (roleType === 'admin') {
        username = document.getElementById('adminUsername').value.trim();
        password = document.getElementById('adminPassword').value;
    } else {
        username = document.getElementById('siswaUsername').value.trim();
        password = document.getElementById('siswaPassword').value;
    }
    
    if (!username || !password) {
        showToast("Username dan password harus diisi", "error");
        return;
    }
    
    try {
        const userQuery = query(collection(db, "users"), where("username", "==", username));
        const snapshot = await getDocs(userQuery);
        
        if (snapshot.empty) {
            showToast("Username tidak ditemukan", "error");
            return;
        }
        
        const userData = snapshot.docs[0].data();
        
        if (roleType === 'admin' && userData.role !== 'admin') {
            showToast("Akun ini bukan admin", "error");
            return;
        }
        if (roleType === 'siswa' && userData.role !== 'user') {
            showToast("Akun ini bukan siswa", "error");
            return;
        }
        
        const email = userData.email;
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Login berhasil");
    } catch (error) {
        console.error(error);
        let msg = "Login gagal: ";
        if (error.code === 'auth/wrong-password') msg += "Password salah";
        else if (error.code === 'auth/user-not-found') msg += "Username tidak valid";
        else msg += error.message;
        showToast(msg, "error");
        
        if (roleType === 'admin') {
            document.getElementById('adminError').innerText = msg;
            document.getElementById('adminError').classList.remove('hidden');
        }
    }
};

// Register Student
window.registerSiswa = async () => {
    const username = document.getElementById('regUsername').value.trim();
    const nama = document.getElementById('regNama').value.trim();
    const nis = document.getElementById('regNis').value.trim();
    const password = document.getElementById('regPasswordSiswa').value;
    
    if (!username || !nama || !nis || !password) {
        showToast("Semua field harus diisi", "error");
        return;
    }
    if (password.length < 6) {
        showToast("Password minimal 6 karakter", "error");
        return;
    }
    
    try {
        const userQuery = query(collection(db, "users"), where("username", "==", username));
        const snapshot = await getDocs(userQuery);
        if (!snapshot.empty()) {
            showToast("Username sudah digunakan", "error");
            return;
        }
        
        const email = usernameToEmail(username);
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        
        await addDoc(collection(db, "users"), {
            uid: userCred.user.uid,
            username: username,
            email: email,
            name: nama,
            nis: nis,
            role: "user"
        });
        
        showToast("Registrasi berhasil! Silakan login.", "success");
        document.getElementById('siswaLoginTab').click();
    } catch (error) {
        console.error(error);
        let msg = "Registrasi gagal: ";
        if (error.code === 'auth/email-already-in-use') msg += "Email sudah terdaftar (coba username lain)";
        else if (error.code === 'auth/operation-not-allowed') msg += "Aktifkan metode Email/Password di Firebase Console";
        else msg += error.message;
        showToast(msg, "error");
    }
};

// Reset Admin Account
async function recreateAdminAccount() {
    const adminUsername = "admin";
    const adminPassword = "admin123";
    const adminEmail = usernameToEmail(adminUsername);
    
    try {
        const adminQuery = query(collection(db, "users"), where("role", "==", "admin"));
        const snapshot = await getDocs(adminQuery);
        const batch = writeBatch(db);
        snapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
        
        try {
            const userCred = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
            await deleteUser(userCred.user);
        } catch(e) { /* ignore if not exists */ }
        
        const userCred = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
        await addDoc(collection(db, "users"), {
            uid: userCred.user.uid,
            username: adminUsername,
            email: adminEmail,
            name: "Administrator Utama",
            nis: "ADMIN001",
            role: "admin"
        });
        
        showToast("Admin berhasil direset! Silakan login dengan username: admin , password: admin123", "success");
        setTimeout(() => location.reload(), 1500);
    } catch (error) {
        console.error(error);
        let msg = "Reset admin gagal: ";
        if (error.code === 'auth/operation-not-allowed') {
            msg += "Harap aktifkan metode masuk Email/Password di Firebase Console.";
        } else {
            msg += error.message;
        }
        showToast(msg, 'error');
        document.getElementById('adminError').innerText = msg;
        document.getElementById('adminError').classList.remove('hidden');
    }
}

// Ensure Admin Account Exists
async function ensureAdminAccount() {
    const adminUsername = "admin";
    const adminPassword = "admin123";
    const adminEmail = usernameToEmail(adminUsername);
    
    try {
        const adminQuery = query(collection(db, "users"), where("role", "==", "admin"));
        const snapshot = await getDocs(adminQuery);
        if (!snapshot.empty) return;
        
        try {
            const userCred = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
            await addDoc(collection(db, "users"), {
                uid: userCred.user.uid,
                username: adminUsername,
                email: adminEmail,
                name: "Administrator Utama",
                nis: "ADMIN001",
                role: "admin"
            });
            showToast("Admin default dipulihkan. Silakan login.", "success");
        } catch (loginError) {
            if (loginError.code === 'auth/user-not-found') {
                const userCred = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
                await addDoc(collection(db, "users"), {
                    uid: userCred.user.uid,
                    username: adminUsername,
                    email: adminEmail,
                    name: "Administrator Utama",
                    nis: "ADMIN001",
                    role: "admin"
                });
                showToast("Akun admin default berhasil dibuat. Silakan login.", "success");
            } else {
                throw loginError;
            }
        }
    } catch (error) {
        console.error("Gagal setup admin:", error);
        let msg = "Setup admin gagal: ";
        if (error.code === 'auth/operation-not-allowed') {
            msg += "Aktifkan metode masuk Email/Password di Firebase Console (Authentication → Sign-in methods).";
        } else {
            msg += error.message;
        }
        showToast(msg, 'error');
        document.getElementById('adminError').innerText = msg;
        document.getElementById('adminError').classList.remove('hidden');
    }
}

// Book Management Functions
async function loadBooks(search = '') {
    const snapshot = await getDocs(collection(db, 'books'));
    let books = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    if (search) {
        return books.filter(b => b.title?.toLowerCase().includes(search.toLowerCase()) || 
                                   b.author?.toLowerCase().includes(search.toLowerCase()));
    }
    return books;
}

async function refreshBooksTable(search = '') {
    const books = await loadBooks(search);
    const container = document.getElementById('booksList');
    if (!books.length) { 
        container.innerHTML = '<p>Tidak ada buku</p>'; 
        return; 
    }
    
    let html = `<div class="table-container"><table class="data-table"><thead><tr><th>Judul</th><th>Pengarang</th><th>Stok</th><th>Aksi</th></tr></thead><tbody>`;
    books.forEach(b => {
        html += `<tr>
                    <td class="p-2">${b.title}</td>
                    <td class="p-2">${b.author}</td>
                    <td class="p-2">${b.stock}</td>
                    <td class="p-2">
                        <button class="editBook bg-yellow-500 px-2 rounded text-white" data-id="${b.id}">Edit</button> 
                        <button class="deleteBook bg-red-500 px-2 rounded text-white" data-id="${b.id}">Hapus</button>
                    </td>
                 </tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    document.querySelectorAll('.editBook').forEach(btn => btn.onclick = () => showBookForm(btn.dataset.id));
    document.querySelectorAll('.deleteBook').forEach(btn => btn.onclick = async () => { 
        if(confirm('Hapus buku ini?')) {
            await deleteDoc(doc(db,'books',btn.dataset.id));
            await refreshBooksTable(document.getElementById('searchBook')?.value || '');
            showToast('Buku berhasil dihapus');
        }
    });
}

async function showBookForm(id = null) {
    let data = { title: '', author: '', year: '', stock: 0 };
    if (id) { 
        const snap = await getDoc(doc(db, 'books', id)); 
        if (snap.exists()) data = snap.data(); 
    }
    
    const modalHtml = `
        <div id="modal" class="modal-overlay">
            <div class="modal-content">
                <h3 class="text-xl font-bold mb-4">${id ? 'Edit' : 'Tambah'} Buku</h3>
                <input id="title" placeholder="Judul" value="${data.title.replace(/"/g, '&quot;')}" class="border p-2 w-full my-2 rounded">
                <input id="author" placeholder="Pengarang" value="${data.author.replace(/"/g, '&quot;')}" class="border p-2 w-full my-2 rounded">
                <input id="year" placeholder="Tahun" value="${data.year}" class="border p-2 w-full my-2 rounded">
                <input id="stock" placeholder="Stok" value="${data.stock}" class="border p-2 w-full my-2 rounded" type="number">
                <div class="flex justify-end gap-2 mt-4">
                    <button id="cancelModal" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Batal</button>
                    <button id="saveModal" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">Simpan</button>
                </div>
            </div>
        </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('cancelModal').onclick = () => document.getElementById('modal').remove();
    document.getElementById('saveModal').onclick = async () => {
        const newData = { 
            title: document.getElementById('title').value, 
            author: document.getElementById('author').value, 
            year: document.getElementById('year').value, 
            stock: parseInt(document.getElementById('stock').value) || 0 
        };
        if (id) {
            await updateDoc(doc(db, 'books', id), newData);
        } else {
            await addDoc(collection(db, 'books'), newData);
        }
        document.getElementById('modal').remove();
        await refreshBooksTable(document.getElementById('searchBook')?.value || '');
        showToast('Buku tersimpan');
    };
}

async function renderBooksManagement() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="bg-white rounded-xl shadow p-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold">📚 Manajemen Buku</h2>
                <button id="addBookBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">+ Tambah Buku</button>
            </div>
            <input id="searchBook" placeholder="Cari buku berdasarkan judul atau pengarang..." class="border p-2 w-full my-3 rounded">
            <div id="booksList"></div>
        </div>`;
    await refreshBooksTable();
    document.getElementById('addBookBtn').onclick = () => showBookForm();
    document.getElementById('searchBook').oninput = async () => refreshBooksTable(document.getElementById('searchBook').value);
}

// Member Management Functions
async function refreshMembers() {
    const q = query(collection(db, 'users'), where('role', '==', 'user'));
    const snap = await getDocs(q);
    const members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const container = document.getElementById('membersList');
    
    if (!members.length) { 
        container.innerHTML = '<p>Belum ada anggota</p>'; 
        return; 
    }
    
    let html = `<div class="table-container"><table class="data-table"><thead><tr><th>Username</th><th>Nama</th><th>NIS</th><th>Aksi</th></tr></thead><tbody>`;
    members.forEach(m => { 
        html += `<tr>
                    <td class="p-2">${m.username}</td>
                    <td class="p-2">${m.name}</td>
                    <td class="p-2">${m.nis}</td>
                    <td class="p-2">
                        <button class="delMember bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-white" data-id="${m.id}">Hapus</button>
                    </td>
                 </tr>`; 
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    document.querySelectorAll('.delMember').forEach(btn => btn.onclick = async () => { 
        if(confirm('Hapus anggota ini?')) {
            await deleteDoc(doc(db,'users',btn.dataset.id));
            await refreshMembers();
            showToast('Anggota berhasil dihapus');
        }
    });
}

async function showMemberForm() {
    const modalHtml = `
        <div id="modal" class="modal-overlay">
            <div class="modal-content">
                <h3 class="text-xl font-bold mb-4">Tambah Anggota Baru</h3>
                <input id="username" placeholder="Username" class="border p-2 w-full my-2 rounded">
                <input id="name" placeholder="Nama Lengkap" class="border p-2 w-full my-2 rounded">
                <input id="nis" placeholder="NIS" class="border p-2 w-full my-2 rounded">
                <input id="pass" type="password" placeholder="Password" class="border p-2 w-full my-2 rounded">
                <div class="flex justify-end gap-2 mt-4">
                    <button id="cancelModal" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Batal</button>
                    <button id="saveMember" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">Simpan</button>
                </div>
            </div>
        </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('cancelModal').onclick = () => document.getElementById('modal').remove();
    document.getElementById('saveMember').onclick = async () => {
        const username = document.getElementById('username').value.trim();
        const name = document.getElementById('name').value.trim();
        const nis = document.getElementById('nis').value.trim();
        const pass = document.getElementById('pass').value;
        
        if (!username || !name || !nis || !pass) { 
            showToast('Semua field harus diisi', 'error'); 
            return; 
        }
        
        const email = usernameToEmail(username);
        try {
            const userCred = await createUserWithEmailAndPassword(auth, email, pass);
            await addDoc(collection(db, 'users'), { 
                uid: userCred.user.uid, 
                username, 
                email, 
                name, 
                nis, 
                role: 'user' 
            });
            showToast('Anggota berhasil ditambahkan');
            document.getElementById('modal').remove();
            await refreshMembers();
        } catch (e) { 
            showToast(e.message, 'error'); 
        }
    };
}

async function renderMembersManagement() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="bg-white p-6 rounded shadow">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold">👥 Manajemen Anggota</h2>
                <button id="addMemberBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">+ Tambah Anggota</button>
            </div>
            <div id="membersList"></div>
        </div>`;
    await refreshMembers();
    document.getElementById('addMemberBtn').onclick = () => showMemberForm();
}

// Transaction Management Functions
async function refreshTransactions() {
    const snap = await getDocs(collection(db, 'transactions'));
    let trans = [];
    for (const d of snap.docs) {
        const data = d.data();
        const user = await getDoc(doc(db, 'users', data.userId));
        const book = await getDoc(doc(db, 'books', data.bookId));
        trans.push({ 
            id: d.id, 
            userName: user.exists() ? user.data().username : '-', 
            bookTitle: book.exists() ? book.data().title : '-', 
            date: data.borrowDate?.toDate().toLocaleDateString(), 
            status: data.status 
        });
    }
    
    const container = document.getElementById('transList');
    if (!trans.length) { 
        container.innerHTML = '<p>Belum ada transaksi peminjaman</p>'; 
        return; 
    }
    
    let html = `<div class="table-container"><table class="data-table"><thead><tr><th>Peminjam</th><th>Buku</th><th>Tgl Pinjam</th><th>Status</th><th>Aksi</th></tr></thead><tbody>`;
    trans.forEach(t => {
        html += `<tr>
                    <td class="p-2">${t.userName}</td>
                    <td class="p-2">${t.bookTitle}</td>
                    <td class="p-2">${t.date}</td>
                    <td class="p-2">${t.status === 'borrowed' ? 'Dipinjam' : 'Dikembalikan'}</td>
                    <td class="p-2">
                        ${t.status === 'borrowed' ? `<button class="returnTrans bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded" data-id="${t.id}">Kembalikan</button>` : '-'}
                    </td>
                 </tr>`;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    document.querySelectorAll('.returnTrans').forEach(btn => btn.onclick = async () => {
        const id = btn.dataset.id;
        const transRef = doc(db, 'transactions', id);
        const data = (await getDoc(transRef)).data();
        await updateDoc(transRef, { status: 'returned', returnDate: Timestamp.now() });
        const bookRef = doc(db, 'books', data.bookId);
        const book = await getDoc(bookRef);
        if (book.exists()) await updateDoc(bookRef, { stock: book.data().stock + 1 });
        showToast('Buku berhasil dikembalikan');
        await refreshTransactions();
    });
}

async function showLoanForm() {
    const books = (await getDocs(collection(db, 'books'))).docs
        .map(d => ({ id: d.id, title: d.data().title, stock: d.data().stock }))
        .filter(b => b.stock > 0);
    const users = (await getDocs(query(collection(db, 'users'), where('role', '==', 'user')))).docs
        .map(d => ({ id: d.id, name: d.data().username }));
    
    const modalHtml = `
        <div id="modal" class="modal-overlay">
            <div class="modal-content">
                <h3 class="text-xl font-bold mb-4">Form Peminjaman Buku</h3>
                <select id="userId" class="border p-2 w-full my-2 rounded">
                    <option value="">Pilih Anggota</option>
                    ${users.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
                </select>
                <select id="bookId" class="border p-2 w-full my-2 rounded">
                    <option value="">Pilih Buku</option>
                    ${books.map(b => `<option value="${b.id}">${b.title} (Stok: ${b.stock})</option>`).join('')}
                </select>
                <div class="flex justify-end gap-2 mt-4">
                    <button id="cancelModal" class="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded">Batal</button>
                    <button id="saveLoan" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded">Pinjam</button>
                </div>
            </div>
        </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('cancelModal').onclick = () => document.getElementById('modal').remove();
    document.getElementById('saveLoan').onclick = async () => {
        const userId = document.getElementById('userId').value;
        const bookId = document.getElementById('bookId').value;
        
        if (!userId || !bookId) { 
            showToast('Lengkapi data peminjaman', 'error'); 
            return; 
        }
        
        const bookRef = doc(db, 'books', bookId);
        const book = await getDoc(bookRef);
        if (book.data().stock <= 0) { 
            showToast('Stok buku habis', 'error'); 
            return; 
        }
        
        await addDoc(collection(db, 'transactions'), { 
            userId, 
            bookId, 
            borrowDate: Timestamp.now(), 
            status: 'borrowed' 
        });
        await updateDoc(bookRef, { stock: book.data().stock - 1 });
        showToast('Peminjaman berhasil');
        document.getElementById('modal').remove();
        await refreshTransactions();
    };
}

async function renderTransactionsManagement() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="bg-white p-6 rounded shadow">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold">📋 Manajemen Transaksi</h2>
                <button id="newLoanBtn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">+ Pinjam Buku</button>
            </div>
            <div id="transList"></div>
        </div>`;
    await refreshTransactions();
    document.getElementById('newLoanBtn').onclick = () => showLoanForm();
}

// User Side Functions
async function refreshUserBooks(search = '') {
    const books = await loadBooks(search);
    const container = document.getElementById('userBooksList');
    if (!books.length) { 
        container.innerHTML = '<p>Tidak ada buku tersedia</p>'; 
        return; 
    }
    
    let html = `<div class="book-grid">`;
    for (const b of books) {
        html += `<div class="book-card">
                    <h3>${b.title}</h3>
                    <p class="text-gray-600">${b.author} (${b.year})</p>
                    <p class="mt-2">Stok: <span class="font-semibold">${b.stock}</span></p>
                    ${b.stock > 0 ? 
                        `<button class="borrowUser bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded mt-3 w-full" data-id="${b.id}">Pinjam Buku</button>` : 
                        '<span class="text-red-500 block mt-3">Stok habis</span>'}
                </div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
    
    document.querySelectorAll('.borrowUser').forEach(btn => btn.onclick = async () => {
        const bookId = btn.dataset.id;
        const bookRef = doc(db, 'books', bookId);
        const book = await getDoc(bookRef);
        
        if (book.data().stock <= 0) { 
            showToast('Stok habis', 'error'); 
            return; 
        }
        
        const existing = await getDocs(query(
            collection(db, 'transactions'), 
            where('userId', '==', currentUserDocId), 
            where('bookId', '==', bookId), 
            where('status', '==', 'borrowed')
        ));
        
        if (!existing.empty) { 
            showToast('Anda sudah meminjam buku ini', 'error'); 
            return; 
        }
        
        await addDoc(collection(db, 'transactions'), { 
            userId: currentUserDocId, 
            bookId, 
            borrowDate: Timestamp.now(), 
            status: 'borrowed' 
        });
        await updateDoc(bookRef, { stock: book.data().stock - 1 });
        showToast('Buku berhasil dipinjam');
        await refreshUserBooks(document.getElementById('searchUser')?.value || '');
    });
}

async function renderUserDashboard() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="bg-white p-6 rounded shadow">
            <h2 class="text-xl font-bold mb-4">📖 Katalog Buku</h2>
            <input id="searchUser" placeholder="Cari buku berdasarkan judul atau pengarang..." class="border p-2 w-full mb-4 rounded">
            <div id="userBooksList"></div>
        </div>`;
    await refreshUserBooks();
    document.getElementById('searchUser').oninput = () => refreshUserBooks(document.getElementById('searchUser').value);
}

async function renderUserBorrowed() {
    const q = query(collection(db, 'transactions'), where('userId', '==', currentUserDocId), where('status', '==', 'borrowed'));
    const snap = await getDocs(q);
    
    let html = `<div class="bg-white p-6 rounded shadow">
                    <h2 class="text-xl font-bold mb-4">📘 Buku yang Sedang Dipinjam</h2>`;
    
    if (snap.empty) {
        html += `<p class="text-gray-500">Tidak ada buku yang sedang dipinjam.</p>`;
    } else {
        html += `<div class="table-container"><table class="data-table"><thead><tr><th>Judul Buku</th><th>Tanggal Pinjam</th><th>Aksi</th></tr></thead><tbody>`;
        for (const d of snap.docs) {
            const trans = d.data();
            const book = await getDoc(doc(db, 'books', trans.bookId));
            const title = book.exists() ? book.data().title : '-';
            const date = trans.borrowDate?.toDate().toLocaleDateString();
            html += `<tr>
                        <td class="p-2">${title}</td>
                        <td class="p-2">${date}</td>
                        <td class="p-2">
                            <button class="returnUser bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded" data-trans="${d.id}" data-book="${trans.bookId}">Kembalikan</button>
                        </td>
                     </tr>`;
        }
        html += `</tbody>}</div>`;
    }
    html += `</div>`;
    document.getElementById('mainContent').innerHTML = html;
    
    document.querySelectorAll('.returnUser').forEach(btn => btn.onclick = async () => {
        const transId = btn.dataset.trans;
        const bookId = btn.dataset.book;
        
        await updateDoc(doc(db, 'transactions', transId), { status: 'returned', returnDate: Timestamp.now() });
        const bookRef = doc(db, 'books', bookId);
        const book = await getDoc(bookRef);
        if (book.exists()) await updateDoc(bookRef, { stock: book.data().stock + 1 });
        showToast('Buku berhasil dikembalikan');
        await renderUserBorrowed();
    });
}

async function renderUserReturn() { 
    await renderUserBorrowed(); 
}

// Documentation Page
function renderDocumentation() {
    document.getElementById('mainContent').innerHTML = `
        <div class="bg-white p-6 rounded shadow">
            <h2 class="text-xl font-bold mb-4">📚 Dokumentasi Sistem</h2>
            <div class="space-y-4">
                <div>
                    <h3 class="font-semibold text-lg">Entity Relationship Diagram (ERD)</h3>
                    <p><strong>Users:</strong> username, email, name, nis, role</p>
                    <p><strong>Books:</strong> title, author, year, stock</p>
                    <p><strong>Transactions:</strong> userId, bookId, borrowDate, returnDate, status</p>
                </div>
                <div>
                    <h3 class="font-semibold text-lg">Fitur Sistem</h3>
                    <ul class="list-disc pl-5">
                        <li>Login menggunakan username + password (bukan email)</li>
                        <li>CRUD Buku (Admin)</li>
                        <li>Kelola Anggota (Admin)</li>
                        <li>Peminjaman dan Pengembalian Buku</li>
                        <li>Pencarian Buku</li>
                        <li>Validasi stok dan pencegahan peminjaman ganda</li>
                    </ul>
                </div>
                <div>
                    <h3 class="font-semibold text-lg">Teknologi</h3>
                    <p>Firebase Auth, Firestore Database, Tailwind CSS, Font Awesome</p>
                </div>
            </div>
        </div>`;
}

async function renderAdminDashboard() { 
    document.getElementById('mainContent').innerHTML = `
        <div class="bg-white p-6 rounded shadow">
            <h2 class="text-2xl font-bold mb-4">Dashboard Administrator</h2>
            <p class="text-gray-600">Selamat datang, Administrator! Gunakan menu di samping untuk mengelola sistem perpustakaan.</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div class="bg-indigo-50 p-4 rounded-lg">
                    <i class="fas fa-book text-2xl text-indigo-600"></i>
                    <h3 class="font-semibold mt-2">Manajemen Buku</h3>
                    <p class="text-sm text-gray-600">Tambah, edit, atau hapus koleksi buku</p>
                </div>
                <div class="bg-green-50 p-4 rounded-lg">
                    <i class="fas fa-users text-2xl text-green-600"></i>
                    <h3 class="font-semibold mt-2">Manajemen Anggota</h3>
                    <p class="text-sm text-gray-600">Kelola data anggota perpustakaan</p>
                </div>
                <div class="bg-blue-50 p-4 rounded-lg">
                    <i class="fas fa-exchange-alt text-2xl text-blue-600"></i>
                    <h3 class="font-semibold mt-2">Transaksi</h3>
                    <p class="text-sm text-gray-600">Pantau peminjaman dan pengembalian</p>
                </div>
            </div>
        </div>`; 
}

// Initialize Application After Login
async function initApp() {
    const appContainer = document.getElementById('appContainer');
    appContainer.innerHTML = `
        <div class="min-h-screen flex flex-col md:flex-row">
            <aside class="bg-indigo-800 text-white w-full md:w-72 p-5 space-y-6">
                <div class="text-2xl font-bold"><i class="fas fa-book-open"></i> Pustaka</div>
                <div class="space-y-1" id="dynamicMenu"></div>
                <div class="pt-10 border-t border-indigo-600 text-sm">
                    <div><i class="fas fa-user-circle"></i> <span id="userInfoSpan"></span></div>
                    <div><i class="fas fa-tag"></i> <span id="userRoleSpan"></span></div>
                    <button onclick="window.logout()" class="mt-3 w-full bg-red-500 hover:bg-red-600 py-2 rounded-lg transition">Logout</button>
                </div>
            </aside>
            <main class="flex-1 p-6 bg-gray-100">
                <div id="pageTitle" class="mb-4 text-2xl font-semibold text-gray-700"></div>
                <div id="mainContent"></div>
            </main>
        </div>`;
    
    window.logout = async () => { 
        await signOut(auth); 
        location.reload(); 
    };
    
    const dynamicMenu = document.getElementById('dynamicMenu');
    const pageTitle = document.getElementById('pageTitle');
    
    if (currentUserRole === 'admin') {
        dynamicMenu.innerHTML = `
            <button data-menu="dashboard" class="sidebar-menu-btn w-full text-left px-4 py-2 rounded mb-1 hover:bg-indigo-700">📊 Dashboard</button>
            <button data-menu="books" class="sidebar-menu-btn w-full text-left px-4 py-2 rounded mb-1 hover:bg-indigo-700">📚 Buku</button>
            <button data-menu="members" class="sidebar-menu-btn w-full text-left px-4 py-2 rounded mb-1 hover:bg-indigo-700">👥 Anggota</button>
            <button data-menu="transactions" class="sidebar-menu-btn w-full text-left px-4 py-2 rounded mb-1 hover:bg-indigo-700">📋 Transaksi</button>
            <button data-menu="docs" class="sidebar-menu-btn w-full text-left px-4 py-2 rounded mb-1 hover:bg-indigo-700">📖 Dokumentasi</button>`;
    } else {
        dynamicMenu.innerHTML = `
            <button data-menu="dashboard" class="sidebar-menu-btn w-full text-left px-4 py-2 rounded mb-1 hover:bg-indigo-700">📖 Daftar Buku</button>
            <button data-menu="my-borrow" class="sidebar-menu-btn w-full text-left px-4 py-2 rounded mb-1 hover:bg-indigo-700">📘 Peminjaman Saya</button>
            <button data-menu="return-book" class="sidebar-menu-btn w-full text-left px-4 py-2 rounded mb-1 hover:bg-indigo-700">🔄 Pengembalian</button>
            <button data-menu="docs" class="sidebar-menu-btn w-full text-left px-4 py-2 rounded mb-1 hover:bg-indigo-700">📖 Dokumentasi</button>`;
    }
    
    document.querySelectorAll('.sidebar-menu-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const menu = btn.getAttribute('data-menu');
            const titles = { 
                dashboard: 'Beranda', 
                books: 'Manajemen Buku', 
                members: 'Manajemen Anggota', 
                transactions: 'Manajemen Transaksi', 
                'my-borrow': 'Peminjaman Saya', 
                'return-book': 'Pengembalian Buku', 
                docs: 'Dokumentasi Sistem' 
            };
            pageTitle.innerText = titles[menu] || 'Menu';
            
            if (menu === 'dashboard') currentUserRole === 'admin' ? await renderAdminDashboard() : await renderUserDashboard();
            else if (menu === 'books') await renderBooksManagement();
            else if (menu === 'members') await renderMembersManagement();
            else if (menu === 'transactions') await renderTransactionsManagement();
            else if (menu === 'my-borrow') await renderUserBorrowed();
            else if (menu === 'return-book') await renderUserReturn();
            else if (menu === 'docs') renderDocumentation();
        });
    });
    
    pageTitle.innerText = 'Beranda';
    if (currentUserRole === 'admin') await renderAdminDashboard();
    else await renderUserDashboard();
    
    const userData = await getDoc(doc(db, 'users', currentUserDocId));
    const username = userData.exists() ? userData.data().username : currentUserObj.email;
    document.getElementById('userInfoSpan').innerText = username;
    document.getElementById('userRoleSpan').innerText = currentUserRole === 'admin' ? 'Administrator' : 'Siswa';
}

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const q = query(collection(db, 'users'), where('uid', '==', user.uid));
        const snap = await getDocs(q);
        
        if (snap.empty) { 
            await signOut(auth); 
            showToast('Akun tidak terdaftar di database', 'error'); 
            return; 
        }
        
        currentUserObj = user;
        currentUserDocId = snap.docs[0].id;
        currentUserRole = snap.docs[0].data().role;
        
        document.getElementById('loginContainer').classList.add('hidden');
        document.getElementById('appContainer').classList.remove('hidden');
        await initApp();
    } else {
        document.getElementById('loginContainer').classList.remove('hidden');
        document.getElementById('appContainer').classList.add('hidden');
    }
});

// Initialize Admin Account
setTimeout(() => ensureAdminAccount(), 1000);

// DOM Event Listeners
document.getElementById('resetAdminBtn').onclick = () => recreateAdminAccount();

// Tab Switching UI
document.getElementById('tabAdminBtn').onclick = () => {
    document.getElementById('panelAdmin').classList.remove('hidden');
    document.getElementById('panelSiswa').classList.add('hidden');
    document.getElementById('tabAdminBtn').classList.add('tab-active');
    document.getElementById('tabAdminBtn').classList.remove('tab-inactive');
    document.getElementById('tabSiswaBtn').classList.add('tab-inactive');
    document.getElementById('tabSiswaBtn').classList.remove('tab-active');
};

document.getElementById('tabSiswaBtn').onclick = () => {
    document.getElementById('panelAdmin').classList.add('hidden');
    document.getElementById('panelSiswa').classList.remove('hidden');
    document.getElementById('tabSiswaBtn').classList.add('tab-active');
    document.getElementById('tabSiswaBtn').classList.remove('tab-inactive');
    document.getElementById('tabAdminBtn').classList.add('tab-inactive');
    document.getElementById('tabAdminBtn').classList.remove('tab-active');
};

document.getElementById('siswaLoginTab').onclick = () => {
    document.getElementById('siswaLoginForm').classList.remove('hidden');
    document.getElementById('siswaRegisterForm').classList.add('hidden');
    document.getElementById('siswaLoginTab').classList.add('border-indigo-600', 'text-indigo-600');
    document.getElementById('siswaLoginTab').classList.remove('text-gray-500', 'border-transparent');
    document.getElementById('siswaRegisterTab').classList.add('text-gray-500', 'border-transparent');
    document.getElementById('siswaRegisterTab').classList.remove('border-indigo-600', 'text-indigo-600');
};

document.getElementById('siswaRegisterTab').onclick = () => {
    document.getElementById('siswaLoginForm').classList.add('hidden');
    document.getElementById('siswaRegisterForm').classList.remove('hidden');
    document.getElementById('siswaRegisterTab').classList.add('border-indigo-600', 'text-indigo-600');
    document.getElementById('siswaRegisterTab').classList.remove('text-gray-500', 'border-transparent');
    document.getElementById('siswaLoginTab').classList.add('text-gray-500', 'border-transparent');
    document.getElementById('siswaLoginTab').classList.remove('border-indigo-600', 'text-indigo-600');
};