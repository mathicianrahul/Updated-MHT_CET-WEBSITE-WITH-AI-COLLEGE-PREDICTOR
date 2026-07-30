/* ==========================================================================
   GLOBAL AUTH UI SYNC & INSTANT LOGOUT ENGINE
   Manages Log In, Sign Up, Profile, Admin navigation state and Instant Logout
   ========================================================================== */

// Helper to determine active API URL dynamically
window.getBackendUrl = function(endpoint) {
    const ep = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
    if (window.location.protocol === "file:") {
        return "http://localhost:5000" + ep;
    }
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        return ep;
    }
    return "https://mhtcet-auth-backend.onrender.com" + ep;
};

// Instant Non-Blocking Logout Handler
window.handleGlobalLogout = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    // 1. INSTANTLY clear local storage & cookies
    try {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        localStorage.removeItem("registered_users");
        sessionStorage.clear();
        document.cookie = "cet.sid=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    } catch (err) {
        console.warn("Storage clear notice:", err);
    }

    // 2. Fire-and-forget backend logout (non-blocking)
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 2000);
        fetch(window.getBackendUrl("/api/logout"), {
            method: "POST",
            credentials: "include",
            signal: controller.signal
        }).catch(() => {});
    } catch (err) {}

    // 3. INSTANT redirect to login page
    window.location.href = "login.html";
};

(function globalAuthUISync() {
    function syncAuthUI() {
        const userStr = localStorage.getItem("user") || sessionStorage.getItem("user");
        
        if (!userStr) {
            // Restore default logged-out UI state
            document.querySelectorAll("a, button").forEach(el => {
                const text = (el.innerText || el.textContent || "").trim().toLowerCase();
                const href = (el.getAttribute("href") || "").toLowerCase();
                const isAuthButton = href === "login.html" || href === "register.html" ||
                                     text === "login" || text === "log in" || text === "sign in" || text === "sign up" || text === "register";
                if (isAuthButton) {
                    el.style.display = "";
                }
            });
            return;
        }

        let user = null;
        try {
            user = JSON.parse(userStr);
        } catch (e) {
            return;
        }
        if (!user) return;

        const name = user.fullname || user.fullName || "Student";
        const words = name.trim().split(/\s+/).filter(Boolean);
        let initials = "ST";
        if (words.length >= 2) {
            initials = (words[0][0] + words[words.length - 1][0]).toUpperCase();
        } else if (words.length === 1 && words[0].length > 0) {
            initials = words[0].slice(0, 2).toUpperCase();
        }

        const isAdmin = user.role === "admin";
        const adminBtnHtml = isAdmin ? `
            <a href="admin.html" class="nav-btn admin-nav-btn" style="text-decoration:none; background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-weight:700; padding:0.45rem 0.85rem; border-radius:10px; display:inline-flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-user-shield"></i> Admin
            </a>
        ` : "";

        // 1. Update Desktop Navbars (.navbar-buttons)
        document.querySelectorAll(".navbar-buttons").forEach(container => {
            container.innerHTML = `
                <a href="predictor.html" class="nav-btn predictor-cta-btn" style="text-decoration:none;">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> AI Predictor
                </a>
                ${adminBtnHtml}
                <a href="profile.html" class="nav-btn profile-nav-btn" style="text-decoration:none; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; font-weight:700; padding:0.45rem 0.95rem; border-radius:10px; display:inline-flex; align-items:center; gap:8px;">
                    <span style="width:22px; height:22px; border-radius:50%; background:#2563eb; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:800;">${initials}</span>
                    <span>My Profile</span>
                </a>
                <button type="button" class="nav-btn logout-btn" onclick="window.handleGlobalLogout(event)" style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca; font-weight:700; padding:0.45rem 0.85rem; border-radius:10px; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-right-from-bracket"></i> Logout
                </button>
            `;
        });

        // 2. Update Mobile Navigation Drawers (.mobile-drawer-actions)
        document.querySelectorAll(".mobile-drawer-actions").forEach(container => {
            container.innerHTML = `
                <a href="predictor.html" class="mobile-action-btn primary"><i class="fa-solid fa-wand-magic-sparkles"></i> Try AI Predictor</a>
                ${isAdmin ? '<a href="admin.html" class="mobile-action-btn secondary" style="background:#fef3c7; color:#b45309;"><i class="fa-solid fa-user-shield"></i> Admin Dashboard</a>' : ''}
                <a href="profile.html" class="mobile-action-btn secondary" style="background:#eff6ff; color:#2563eb; font-weight:700;"><i class="fa-solid fa-user-circle"></i> My Profile</a>
                <button type="button" class="mobile-action-btn secondary" onclick="window.handleGlobalLogout(event)" style="background:#fef2f2; color:#dc2626; font-weight:700; border:1px solid #fecaca; width:100%; cursor:pointer;">
                    <i class="fa-solid fa-right-from-bracket"></i> Logout
                </button>
            `;
        });

        // 3. Scan & Hide any standalone Log In / Sign Up buttons across document
        document.querySelectorAll("a, button").forEach(el => {
            const text = (el.innerText || el.textContent || "").trim().toLowerCase();
            const href = (el.getAttribute("href") || "").toLowerCase();
            const isAuthButton = href === "login.html" || href === "register.html" ||
                                 text === "login" || text === "log in" || text === "sign in" || text === "sign up" || text === "register";

            if (isAuthButton && !el.closest("#loginForm") && !el.closest("#registerForm") && !el.closest("#auth-gate") && !el.closest(".profile-logout-section")) {
                el.style.display = "none";
            }
        });
    }

    window.globalAuthUISync = syncAuthUI;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", syncAuthUI);
    } else {
        syncAuthUI();
    }
})();

/* ==========================================================================
   GLOBAL MOBILE NAVIGATION DRAWER BINDING ENGINE
   ========================================================================== */
(function globalMobileDrawerEngine() {
    function bindDrawerEvents() {
        const mobileHamburgerBtn = document.getElementById("mobileHamburgerBtn");
        const mobileNavDrawer = document.getElementById("mobileNavDrawer");
        const mobileNavBackdrop = document.getElementById("mobileNavBackdrop");
        const mobileDrawerClose = document.getElementById("mobileDrawerClose");

        function openDrawer(e) {
            if (e) e.preventDefault();
            if (mobileNavDrawer) mobileNavDrawer.classList.add("active");
            if (mobileNavBackdrop) mobileNavBackdrop.classList.add("active");
            document.body.style.overflow = "hidden";
        }

        function closeDrawer(e) {
            if (e) e.preventDefault();
            if (mobileNavDrawer) mobileNavDrawer.classList.remove("active");
            if (mobileNavBackdrop) mobileNavBackdrop.classList.remove("active");
            document.body.style.overflow = "";
        }

        if (mobileHamburgerBtn) {
            mobileHamburgerBtn.onclick = openDrawer;
        }
        if (mobileDrawerClose) {
            mobileDrawerClose.onclick = closeDrawer;
        }
        if (mobileNavBackdrop) {
            mobileNavBackdrop.onclick = closeDrawer;
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bindDrawerEvents);
    } else {
        bindDrawerEvents();
    }
})();
