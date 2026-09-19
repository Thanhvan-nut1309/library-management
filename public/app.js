/**
 * Library Management System - Frontend Application Logic
 * Modern Vanilla JS with Dynamic ECS Fargate API Base URL Configuration
 */

(function () {
  'use strict';

  // ==========================================
  // Global State
  // ==========================================
  const DEFAULT_API_URL = 'https://d1x3ohhxqqai40.cloudfront.net';
  const OLD_ALB_URL = 'http://alb-library-management-1208468593.ap-southeast-2.elb.amazonaws.com';

  let savedApiUrl = localStorage.getItem('lib_api_url');
  if (savedApiUrl === OLD_ALB_URL) {
    savedApiUrl = DEFAULT_API_URL;
    localStorage.setItem('lib_api_url', DEFAULT_API_URL);
  }

  let state = {
    apiBaseUrl: savedApiUrl || DEFAULT_API_URL,
    token: localStorage.getItem('lib_token') || null,
    user: JSON.parse(localStorage.getItem('lib_user') || 'null'),
    books: [],
    borrowRecords: [],
    activeCategory: 'all',
    searchQuery: '',
    activeSubtab: 'my-records',
    editingBookId: null,
  };

  // ==========================================
  // Helper: Toast Notifications
  // ==========================================
  function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-triangle';

    toast.innerHTML = `
      <i class="fa-solid ${iconClass}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ==========================================
  // Core API Fetch Wrapper
  // ==========================================
  async function fetchAPI(endpoint, options = {}) {
    let url = endpoint;
    if (!endpoint.startsWith('http')) {
      let baseUrl = state.apiBaseUrl.replace(/\/+$/, '');
      if (!baseUrl.endsWith('/api') && !endpoint.startsWith('/api')) {
        baseUrl += '/api';
      }
      url = `${baseUrl}${endpoint}`;
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.message || `Lỗi HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      console.error(`API Call failed [${endpoint}]:`, err);
      throw err;
    }
  }

  // ==========================================
  // Initialization & UI Refresh
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    initUI();
    bindEvents();
    loadBooks();
    checkBackendHealth();
  });

  function initUI() {
    updateApiStatusDisplay();
    renderAuthWidget();
    renderSubtabsVisibility();

    // Set initial API URL input value
    const inputApi = document.getElementById('input-api-url');
    if (inputApi) inputApi.value = state.apiBaseUrl;
  }

  function updateApiStatusDisplay() {
    const apiLabel = document.getElementById('api-label-text');
    const dot = document.getElementById('api-status-dot');

    if (apiLabel) {
      let displayUrl = state.apiBaseUrl;
      if (displayUrl.length > 25) {
        displayUrl = displayUrl.substring(0, 22) + '...';
      }
      apiLabel.textContent = `API: ${displayUrl}`;
    }

    if (dot) {
      dot.className = 'status-dot online';
    }
  }

  async function checkBackendHealth() {
    const startTime = performance.now();
    try {
      let baseUrl = state.apiBaseUrl.replace(/\/+$/, '');
      let healthUrl = baseUrl.endsWith('/api')
        ? baseUrl.replace(/\/api$/, '/health')
        : `${baseUrl}/health`;

      const res = await fetch(healthUrl).then(r => r.json()).catch(() => null);
      const latency = Math.round(performance.now() - startTime);

      const latencyElem = document.getElementById('stat-api-latency');
      if (latencyElem) {
        latencyElem.textContent = res && res.status === 'ok' ? `${latency} ms` : 'Offline';
      }

      const dot = document.getElementById('api-status-dot');
      if (dot) {
        dot.className = res && res.status === 'ok' ? 'status-dot online' : 'status-dot offline';
      }
    } catch (e) {
      const latencyElem = document.getElementById('stat-api-latency');
      if (latencyElem) latencyElem.textContent = 'Lỗi kết nối';
      const dot = document.getElementById('api-status-dot');
      if (dot) dot.className = 'status-dot offline';
    }
  }

  function renderAuthWidget() {
    const container = document.getElementById('user-auth-widget');
    const btnAddBook = document.getElementById('btn-add-book');

    if (!container) return;

    if (state.user && state.token) {
      const isRoleAdmin = state.user.role === 'admin';

      container.innerHTML = `
        <div class="user-badge">
          <div class="user-avatar">${state.user.name.charAt(0).toUpperCase()}</div>
          <div class="user-info-text">
            <span class="user-name">${escapeHtml(state.user.name)}</span>
            <span class="user-role-pill ${isRoleAdmin ? 'role-admin' : 'role-user'}">
              ${isRoleAdmin ? 'Thủ thư / Admin' : 'Độc giả'}
            </span>
          </div>
          <button class="btn btn-glass btn-sm" id="btn-logout" title="Đăng xuất">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      `;

      if (btnAddBook) {
        btnAddBook.style.display = isRoleAdmin ? 'inline-flex' : 'none';
      }

      document.getElementById('btn-logout')?.addEventListener('click', handleLogout);
    } else {
      container.innerHTML = `
        <button class="btn btn-glass btn-sm" id="btn-open-login">
          <i class="fa-solid fa-right-to-bracket"></i> Đăng Nhập
        </button>
      `;

      if (btnAddBook) btnAddBook.style.display = 'none';

      document.getElementById('btn-open-login')?.addEventListener('click', () => {
        openModal('modal-auth');
      });
    }

    renderSubtabsVisibility();
  }

  function renderSubtabsVisibility() {
    const subtabAll = document.getElementById('subtab-all-records');
    const isRoleAdmin = state.user && state.user.role === 'admin';

    if (subtabAll) {
      subtabAll.style.display = isRoleAdmin ? 'inline-block' : 'none';
    }
  }

  // ==========================================
  // Event Binding
  // ==========================================
  function bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = btn.getAttribute('data-tab');
        switchMainTab(tabId, btn);
      });
    });

    // Subtabs in Borrow Page
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeSubtab = btn.getAttribute('data-subtab');

        const filterWrapper = document.getElementById('status-filter-wrapper');
        if (filterWrapper) {
          filterWrapper.style.display = state.activeSubtab === 'all-records' ? 'flex' : 'none';
        }

        loadBorrowRecords();
      });
    });

    // Category Filter Pills
    document.querySelectorAll('.pill-btn').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.pill-btn').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.activeCategory = pill.getAttribute('data-cat');
        renderBooks();
      });
    });

    // Search Input with Debounce
    let searchTimeout = null;
    const searchInput = document.getElementById('search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        if (btnClearSearch) btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          loadBooks(state.searchQuery);
        }, 300);
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        state.searchQuery = '';
        btnClearSearch.style.display = 'none';
        loadBooks();
      });
    }

    // Modal Triggers & Close
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        closeModal(modalId);
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeModal(overlay.id);
        }
      });
    });

    // API Config Modal Triggers
    document.getElementById('btn-open-api-config')?.addEventListener('click', () => {
      document.getElementById('input-api-url').value = state.apiBaseUrl;
      openModal('modal-api-config');
    });

    document.getElementById('preset-cloudfront')?.addEventListener('click', () => {
      document.getElementById('input-api-url').value = 'https://d1x3ohhxqqai40.cloudfront.net';
    });

    document.getElementById('preset-relative')?.addEventListener('click', () => {
      document.getElementById('input-api-url').value = '/api';
    });

    document.getElementById('preset-localhost')?.addEventListener('click', () => {
      document.getElementById('input-api-url').value = 'http://localhost:3000';
    });

    document.getElementById('btn-reset-api-url')?.addEventListener('click', () => {
      document.getElementById('input-api-url').value = DEFAULT_API_URL;
    });

    document.getElementById('btn-save-api-url')?.addEventListener('click', saveApiConfig);

    // API Test Buttons
    document.getElementById('btn-test-health')?.addEventListener('click', testApiHealth);
    document.getElementById('btn-test-books')?.addEventListener('click', testApiBooks);

    // Auth Forms & Quick Acc
    document.getElementById('auth-tab-login')?.addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('auth-tab-register')?.addEventListener('click', () => switchAuthTab('register'));
    document.getElementById('form-login')?.addEventListener('submit', handleLoginSubmit);
    document.getElementById('form-register')?.addEventListener('submit', handleRegisterSubmit);

    document.getElementById('btn-fill-admin')?.addEventListener('click', () => {
      document.getElementById('login-email').value = 'admin@library.local';
      document.getElementById('login-password').value = 'Admin@123';
    });

    document.getElementById('btn-fill-user')?.addEventListener('click', () => {
      document.getElementById('login-email').value = 'user@library.local';
      document.getElementById('login-password').value = 'User@123';
    });

    // Admin Add Book Form
    document.getElementById('btn-add-book')?.addEventListener('click', openAddBookModal);
    document.getElementById('form-book')?.addEventListener('submit', handleBookSubmit);

    // Status Filter for Borrow Table
    document.getElementById('borrow-status-filter')?.addEventListener('change', () => {
      loadBorrowRecords();
    });
  }

  // ==========================================
  // Main Tab Navigation
  // ==========================================
  function switchMainTab(tabId, btnElement) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    if (btnElement) btnElement.classList.add('active');
    const targetPane = document.getElementById(tabId);
    if (targetPane) targetPane.classList.add('active');

    if (tabId === 'tab-borrow') {
      loadBorrowRecords();
    }
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  function switchAuthTab(tab) {
    const loginTabBtn = document.getElementById('auth-tab-login');
    const regTabBtn = document.getElementById('auth-tab-register');
    const loginForm = document.getElementById('form-login');
    const regForm = document.getElementById('form-register');

    if (tab === 'login') {
      loginTabBtn.classList.add('active');
      regTabBtn.classList.remove('active');
      loginForm.classList.add('active');
      regForm.classList.remove('active');
    } else {
      regTabBtn.classList.add('active');
      loginTabBtn.classList.remove('active');
      regForm.classList.add('active');
      loginForm.classList.remove('active');
    }
  }

  // ==========================================
  // API Configuration & Test Actions
  // ==========================================
  function saveApiConfig() {
    const inputVal = document.getElementById('input-api-url').value.trim();
    if (!inputVal) {
      showToast('Vui lòng nhập đường dẫn API Endpoint hợp lệ.', 'error');
      return;
    }

    state.apiBaseUrl = inputVal;
    localStorage.setItem('lib_api_url', state.apiBaseUrl);

    updateApiStatusDisplay();
    showToast('Đã cập nhật cấu hình API Endpoint!', 'success');
    closeModal('modal-api-config');

    loadBooks();
    checkBackendHealth();
  }

  async function testApiHealth() {
    const statusElem = document.getElementById('test-result-status');
    const timeElem = document.getElementById('test-result-time');
    const jsonElem = document.getElementById('test-result-json');

    statusElem.textContent = 'Đang kiểm tra GET /health...';
    statusElem.style.color = '#fbbf24';
    jsonElem.textContent = '// Sending HTTP GET request...';

    const startTime = performance.now();
    try {
      let healthUrl = state.apiBaseUrl.endsWith('/api')
        ? state.apiBaseUrl.replace(/\/api$/, '/health')
        : `${state.apiBaseUrl}/health`;

      const res = await fetch(healthUrl);
      const data = await res.json();
      const latency = Math.round(performance.now() - startTime);

      statusElem.textContent = `200 OK (${res.status})`;
      statusElem.style.color = '#34d399';
      timeElem.textContent = `${latency} ms`;
      jsonElem.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      statusElem.textContent = 'Kết nối Thất bại';
      statusElem.style.color = '#fca5a5';
      timeElem.textContent = '';
      jsonElem.textContent = `Lỗi: ${err.message}\nKểm tra lại IP/Domain của ALB ECS Fargate và CORS headers.`;
    }
  }

  async function testApiBooks() {
    const statusElem = document.getElementById('test-result-status');
    const timeElem = document.getElementById('test-result-time');
    const jsonElem = document.getElementById('test-result-json');

    statusElem.textContent = 'Đang gửi GET /api/books...';
    statusElem.style.color = '#fbbf24';
    jsonElem.textContent = '// Fetching books data from database...';

    const startTime = performance.now();
    try {
      const data = await fetchAPI('/books');
      const latency = Math.round(performance.now() - startTime);

      statusElem.textContent = `200 OK (${data.length} sách)`;
      statusElem.style.color = '#34d399';
      timeElem.textContent = `${latency} ms`;
      jsonElem.textContent = JSON.stringify(data.slice(0, 3), null, 2) + (data.length > 3 ? '\n... (và các cuốn sách khác)' : '');
    } catch (err) {
      statusElem.textContent = 'Lỗi API';
      statusElem.style.color = '#fca5a5';
      timeElem.textContent = '';
      jsonElem.textContent = `Lỗi: ${err.message}`;
    }
  }

  // ==========================================
  // Auth Business Logic
  // ==========================================
  async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const btn = document.getElementById('btn-submit-login');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng nhập...';

    try {
      const data = await fetchAPI('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('lib_token', data.token);
      localStorage.setItem('lib_user', JSON.stringify(data.user));

      showToast(`Chào mừng ${data.user.name} đã quay trở lại!`, 'success');
      closeModal('modal-auth');
      renderAuthWidget();
      loadBooks();
    } catch (err) {
      showToast(err.message || 'Đăng nhập không thành công.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Đăng Nhập';
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    const btn = document.getElementById('btn-submit-register');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';

    try {
      await fetchAPI('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });

      showToast('Đăng ký tài khoản thành công! Bạn có thể đăng nhập ngay.', 'success');
      switchAuthTab('login');
      document.getElementById('login-email').value = email;
      document.getElementById('login-password').value = password;
    } catch (err) {
      showToast(err.message || 'Đăng ký không thành công.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Tạo Tài Khoản Mới';
    }
  }

  function handleLogout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('lib_token');
    localStorage.removeItem('lib_user');

    showToast('Đã đăng xuất khỏi hệ thống.', 'info');
    renderAuthWidget();
    loadBooks();
  }

  // ==========================================
  // Books Catalog Operations
  // ==========================================
  let isDbConnected = true;

  async function loadBooks(query = '') {
    try {
      const endpoint = query ? `/books?q=${encodeURIComponent(query)}` : '/books';
      state.books = await fetchAPI(endpoint);
      isDbConnected = true;
      renderBooks();
      updateOverviewStats();
    } catch (err) {
      console.warn('API Books error:', err);
      isDbConnected = false;
      state.books = [];
      showToast('API trả về lỗi hoặc chưa kết nối được Database MySQL.', 'error');
      renderBooks(err.message);
      updateOverviewStats();
    }
  }

  function renderBooks(errorDetails = '') {
    const grid = document.getElementById('books-grid');
    const emptyState = document.getElementById('books-empty');
    if (!grid) return;

    let filtered = state.books;
    if (state.activeCategory !== 'all') {
      filtered = filtered.filter(b => b.category === state.activeCategory);
    }

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (emptyState) {
        const titleElem = document.getElementById('books-empty-title');
        const descElem = document.getElementById('books-empty-desc');

        if (!isDbConnected) {
          if (titleElem) titleElem.textContent = 'Chưa kết nối cơ sở dữ liệu MySQL';
          if (descElem) descElem.innerHTML = `
            Backend API đang chạy nhưng chưa thể kết nối đến Database MySQL.<br/>
            <small class="text-muted">${escapeHtml(errorDetails || 'Kiểm tra file .env (DB_HOST, DB_USER, DB_PASSWORD) hoặc bật MySQL Docker.')}</small>
          `;
        } else if (state.searchQuery || state.activeCategory !== 'all') {
          if (titleElem) titleElem.textContent = 'Không tìm thấy cuốn sách nào';
          if (descElem) descElem.textContent = 'Thử tìm kiếm với từ khoá khác hoặc chọn thể loại khác.';
        } else {
          if (titleElem) titleElem.textContent = 'Thư viện chưa có sách';
          if (descElem) descElem.textContent = 'Bấm nút "Thêm Sách Mới" (với tài khoản Admin) để tạo đầu sách đầu tiên.';
        }

        emptyState.style.display = 'block';
      }
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    const isRoleAdmin = state.user && state.user.role === 'admin';

    grid.innerHTML = filtered.map(book => {
      const hasCover = book.cover_image_url && book.cover_image_url.startsWith('http');
      const isAvailable = book.available_copies > 0;

      return `
        <div class="book-card" data-id="${book.id}">
          <div class="book-cover-wrapper">
            ${hasCover
          ? `<img src="${escapeHtml(book.cover_image_url)}" alt="${escapeHtml(book.title)}" class="book-cover-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
                 <div class="book-cover-placeholder" style="display:none;"><i class="fa-solid fa-book"></i></div>`
          : `<div class="book-cover-placeholder"><i class="fa-solid fa-book"></i></div>`
        }
            ${book.category ? `<span class="category-badge">${escapeHtml(book.category)}</span>` : ''}
            <span class="copies-badge ${isAvailable ? 'badge-in-stock' : 'badge-out-stock'}">
              ${isAvailable ? `${book.available_copies}/${book.total_copies} sẵn có` : 'Hết sách'}
            </span>
          </div>

          <div class="book-card-body">
            <div>
              <h3 class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h3>
              <p class="book-author"><i class="fa-solid fa-user-pen"></i> ${escapeHtml(book.author)}</p>
            </div>

            <div class="book-card-actions">
              <button class="btn ${isAvailable ? 'btn-primary' : 'btn-secondary'} btn-sm btn-borrow" 
                      data-id="${book.id}" ${!isAvailable ? 'disabled' : ''}>
                <i class="fa-solid fa-bookmark"></i> ${isAvailable ? 'Mượn Sách' : 'Hết Sách'}
              </button>

              ${isRoleAdmin ? `
                <div class="book-admin-btns">
                  <button class="btn btn-secondary btn-sm btn-edit-book" data-id="${book.id}" title="Chỉnh sửa">
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button class="btn btn-danger btn-sm btn-delete-book" data-id="${book.id}" title="Xoá sách">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Bind action buttons inside grid
    grid.querySelectorAll('.btn-borrow').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        handleBorrowBook(id);
      });
    });

    if (isRoleAdmin) {
      grid.querySelectorAll('.btn-edit-book').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          openEditBookModal(id);
        });
      });

      grid.querySelectorAll('.btn-delete-book').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          handleDeleteBook(id);
        });
      });
    }
  }

  function updateOverviewStats() {
    const totalElem = document.getElementById('stat-total-books');
    const availableElem = document.getElementById('stat-available-copies');
    const activeBorrowsElem = document.getElementById('stat-active-borrows');

    if (totalElem) totalElem.textContent = state.books.length;

    const availableSum = state.books.reduce((acc, b) => acc + (b.available_copies || 0), 0);
    const totalSum = state.books.reduce((acc, b) => acc + (b.total_copies || 0), 0);

    if (availableElem) availableElem.textContent = availableSum;
    if (activeBorrowsElem) activeBorrowsElem.textContent = Math.max(totalSum - availableSum, 0);
  }

  async function handleBorrowBook(bookId) {
    if (!state.token) {
      showToast('Vui lòng đăng nhập trước khi mượn sách.', 'info');
      openModal('modal-auth');
      return;
    }

    try {
      const data = await fetchAPI('/borrow', {
        method: 'POST',
        body: JSON.stringify({ book_id: parseInt(bookId, 10) }),
      });

      showToast(`Mượn sách thành công! Hạn trả là ${data.due_date}.`, 'success');
      loadBooks();
    } catch (err) {
      showToast(err.message || 'Không thể mượn sách.', 'error');
    }
  }

  // ==========================================
  // Admin Book CRUD
  // ==========================================
  function openAddBookModal() {
    state.editingBookId = null;
    document.getElementById('book-modal-title').innerHTML = '<i class="fa-solid fa-book-medical color-primary"></i> Thêm Sách Mới';
    document.getElementById('form-book').reset();
    document.getElementById('book-form-id').value = '';
    openModal('modal-book-form');
  }

  function openEditBookModal(bookId) {
    const book = state.books.find(b => b.id == bookId);
    if (!book) return;

    state.editingBookId = bookId;
    document.getElementById('book-modal-title').innerHTML = '<i class="fa-solid fa-pen-to-square color-primary"></i> Chỉnh Sửa Thông Tin Sách';
    document.getElementById('book-form-id').value = book.id;
    document.getElementById('book-title').value = book.title;
    document.getElementById('book-author').value = book.author;
    document.getElementById('book-category').value = book.category || '';
    document.getElementById('book-total-copies').value = book.total_copies;
    document.getElementById('book-cover-url').value = book.cover_image_url || '';

    openModal('modal-book-form');
  }

  async function handleBookSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('book-title').value.trim();
    const author = document.getElementById('book-author').value.trim();
    const category = document.getElementById('book-category').value.trim();
    const total_copies = parseInt(document.getElementById('book-total-copies').value, 10);
    const cover_image_url = document.getElementById('book-cover-url').value.trim();

    const payload = { title, author, category, total_copies, cover_image_url };

    try {
      if (state.editingBookId) {
        await fetchAPI(`/books/${state.editingBookId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        showToast('Đã cập nhật thông tin sách!', 'success');
      } else {
        await fetchAPI('/books', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Đã thêm cuốn sách mới thành công!', 'success');
      }

      closeModal('modal-book-form');
      loadBooks();
    } catch (err) {
      showToast(err.message || 'Lỗi khi lưu thông tin sách.', 'error');
    }
  }

  async function handleDeleteBook(bookId) {
    if (!confirm('Bạn có chắc chắn muốn xoá cuốn sách này khỏi thư viện?')) return;

    try {
      await fetchAPI(`/books/${bookId}`, { method: 'DELETE' });
      showToast('Đã xoá cuốn sách.', 'info');
      loadBooks();
    } catch (err) {
      showToast(err.message || 'Không thể xoá sách.', 'error');
    }
  }

  // ==========================================
  // Borrow & Return Records Operations
  // ==========================================
  async function loadBorrowRecords() {
    if (!state.token) {
      renderBorrowTable([]);
      showBorrowEmpty('Bạn cần đăng nhập để xem danh sách mượn sách.', 'Đăng nhập với tài khoản độc giả hoặc thủ thư.');
      return;
    }

    try {
      let records = [];
      if (state.activeSubtab === 'all-records' && state.user.role === 'admin') {
        const filterVal = document.getElementById('borrow-status-filter')?.value || '';
        const endpoint = filterVal ? `/borrow?status=${filterVal}` : '/borrow';
        records = await fetchAPI(endpoint);
      } else {
        records = await fetchAPI('/borrow/me');
      }

      state.borrowRecords = records;
      renderBorrowTable(records);
    } catch (err) {
      showToast('Không thể tải lịch sử mượn sách.', 'error');
    }
  }

  function renderBorrowTable(records) {
    const tbody = document.getElementById('borrow-tbody');
    const emptyState = document.getElementById('borrow-empty');
    if (!tbody) return;

    if (records.length === 0) {
      tbody.innerHTML = '';
      showBorrowEmpty('Không tìm thấy lượt mượn sách nào', 'Danh sách đang trống.');
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = records.map(r => {
      let statusBadge = '';
      if (r.status === 'borrowing') {
        statusBadge = `<span class="status-pill status-borrowing"><i class="fa-solid fa-clock"></i> Đang mượn</span>`;
      } else if (r.status === 'returned') {
        statusBadge = `<span class="status-pill status-returned"><i class="fa-solid fa-check"></i> Đã trả</span>`;
      } else {
        statusBadge = `<span class="status-pill status-overdue"><i class="fa-solid fa-triangle-exclamation"></i> Quá hạn</span>`;
      }

      const isBorrowing = r.status === 'borrowing' || r.status === 'overdue';

      return `
        <tr>
          <td>#${r.id}</td>
          <td><strong>${escapeHtml(r.title)}</strong></td>
          <td>${r.user_name ? escapeHtml(r.user_name) : (state.user ? escapeHtml(state.user.name) : 'Độc giả')}</td>
          <td>${r.borrow_date ? r.borrow_date.slice(0, 10) : '--'}</td>
          <td><strong>${r.due_date ? r.due_date.slice(0, 10) : '--'}</strong></td>
          <td>${statusBadge}</td>
          <td>
            ${isBorrowing ? `
              <button class="btn btn-success btn-sm btn-return-book" data-id="${r.id}">
                <i class="fa-solid fa-rotate-left"></i> Trả Sách
              </button>
            ` : '<span class="text-xs text-muted">Hoàn tất</span>'}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.btn-return-book').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        handleReturnBook(id);
      });
    });
  }

  function showBorrowEmpty(title, desc) {
    const emptyState = document.getElementById('borrow-empty');
    const titleElem = document.getElementById('borrow-empty-title');
    const descElem = document.getElementById('borrow-empty-desc');

    if (titleElem) titleElem.textContent = title;
    if (descElem) descElem.textContent = desc;
    if (emptyState) emptyState.style.display = 'block';
  }

  async function handleReturnBook(recordId) {
    try {
      await fetchAPI(`/borrow/${recordId}/return`, { method: 'PUT' });
      showToast('Trả sách thành công! Cảm ơn bạn đã giữ gìn sách.', 'success');
      loadBorrowRecords();
      loadBooks();
    } catch (err) {
      showToast(err.message || 'Không thể thực hiện trả sách.', 'error');
    }
  }

})();
