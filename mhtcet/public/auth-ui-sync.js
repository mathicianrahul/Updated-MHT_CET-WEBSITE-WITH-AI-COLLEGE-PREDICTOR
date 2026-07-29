/* ==========================================================================
   GLOBAL AUTH UI SYNC ENGINE
   Completely removes Log In & Sign Up buttons on ALL pages after login
   ========================================================================== */

(function globalAuthUISync() {
    function syncAuthUI() {
        const userStr = localStorage.getItem("user") || sessionStorage.getItem("user");
        if (!userStr) return;

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

        // 1. Update Desktop Navbars (.navbar-buttons)
        document.querySelectorAll(".navbar-buttons").forEach(container => {
            container.innerHTML = `
                <a href="predictor.html" class="nav-btn predictor-cta-btn" style="text-decoration:none;">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> AI Predictor
                </a>
                <a href="profile.html" class="nav-btn profile-nav-btn" style="text-decoration:none; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; font-weight:700; padding:0.45rem 0.95rem; border-radius:10px; display:inline-flex; align-items:center; gap:8px;">
                    <span style="width:22px; height:22px; border-radius:50%; background:#2563eb; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:800;">${initials}</span>
                    <span>My Profile</span>
                </a>
            `;
        });

        // 3. Update Mobile Navigation Drawers (.mobile-drawer-actions)
        document.querySelectorAll(".mobile-drawer-actions").forEach(container => {
            container.innerHTML = `
                <a href="predictor.html" class="mobile-action-btn primary"><i class="fa-solid fa-wand-magic-sparkles"></i> Try AI Predictor</a>
                <a href="profile.html" class="mobile-action-btn secondary" style="background:#eff6ff; color:#2563eb; font-weight:700;"><i class="fa-solid fa-user-circle"></i> My Profile</a>
            `;
        });

        // 4. Scan & Hide any standalone Log In / Sign Up buttons across the entire document
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
