// Main Application JavaScript

const ROLE_DETAILS = {
    admin: {
        name: 'System Administrator',
        placeholder: 'admin@saividya.ac.in',
        hint: 'Access full fleet administration, user management & logs',
        badge: 'Admin'
    },
    scanner: {
        name: 'Bus QR Scanner Kiosk',
        placeholder: 'scanner1@saividya.ac.in',
        hint: 'Access onboard QR attendance scanner for bus-mounted kiosk display',
        badge: 'Scanner'
    },
    faculty: {
        name: 'Faculty Member',
        placeholder: 'faculty@saividya.ac.in',
        hint: 'Access bus pass verification, faculty transport & stop ETAs',
        badge: 'Faculty'
    },
    student: {
        name: 'Student',
        placeholder: 'student@saividya.ac.in',
        hint: 'Access student bus route tracking, QR pass & live location',
        badge: 'Student'
    },
    parent: {
        name: 'Parent / Guardian',
        placeholder: 'parent@saividya.ac.in',
        hint: 'Access child bus boarding status, live GPS & ETA notifications',
        badge: 'Parent'
    }
};

let currentRole = 'student';

// Initialize Page
document.addEventListener('DOMContentLoaded', () => {
    // Check initial active role input value if any
    const roleInput = document.getElementById('selected-role-input');
    if (roleInput && roleInput.value) {
        switchRole(roleInput.value);
    } else {
        switchRole('student');
    }
});

// Switch Role Function
function switchRole(roleKey) {
    if (!ROLE_DETAILS[roleKey]) return;
    currentRole = roleKey;

    // Update Role Input
    const roleInput = document.getElementById('selected-role-input');
    if (roleInput) roleInput.value = roleKey;

    // Update UI active buttons
    const roleButtons = document.querySelectorAll('.role-btn');
    roleButtons.forEach(btn => {
        if (btn.getAttribute('data-role') === roleKey) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update Text Details
    const roleSubtext = document.getElementById('role-subtitle');
    if (roleSubtext) {
        roleSubtext.textContent = ROLE_DETAILS[roleKey].hint;
    }

    const emailInput = document.getElementById('email-input');
    if (emailInput) {
        emailInput.placeholder = ROLE_DETAILS[roleKey].placeholder;
    }

    const submitBtnText = document.getElementById('submit-btn-text');
    if (submitBtnText) {
        submitBtnText.textContent = `Login as ${ROLE_DETAILS[roleKey].badge}`;
    }

    // Update Notice Banner
    const noticeBanner = document.getElementById('notice-banner');
    const noticeText = document.getElementById('notice-text');
    if (noticeBanner && noticeText) {
        noticeText.textContent = `Selected portal: ${ROLE_DETAILS[roleKey].name}`;
        noticeBanner.style.borderColor = 'rgba(59, 130, 246, 0.35)';
        noticeBanner.style.color = '#93c5fd';
    }
}

// Password Visibility Toggle
function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password-input');
    const eyeIcon = document.getElementById('eye-icon');

    if (passwordInput && eyeIcon) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.className = 'bi bi-eye-fill';
        } else {
            passwordInput.type = 'password';
            eyeIcon.className = 'bi bi-eye-slash-fill';
        }
    }
}

// Handle Form Submission
async function handleLoginSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const submitBtn = document.getElementById('submit-btn');
    const submitBtnText = document.getElementById('submit-btn-text');
    const noticeText = document.getElementById('notice-text');
    const noticeBanner = document.getElementById('notice-banner');

    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;

    if (!email || !password) {
        if (noticeBanner && noticeText) {
            noticeText.textContent = 'Please enter both email and password.';
            noticeBanner.style.borderColor = '#f87171';
            noticeBanner.style.color = '#fca5a5';
        }
        return;
    }

    // Disable button & show loading state
    submitBtn.disabled = true;
    submitBtnText.textContent = 'Authenticating...';

    try {
        const formData = new FormData(form);
        const response = await fetch('/login', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            if (noticeBanner && noticeText) {
                noticeBanner.style.borderColor = '#34d399';
                noticeBanner.style.color = '#6ee7b7';
                noticeText.textContent = data.message;
            }
            submitBtnText.textContent = 'Redirecting...';
            
            setTimeout(() => {
                window.location.href = data.redirect_url || (currentRole === 'admin' ? '/admin/dashboard' : '/');
            }, 600);
        } else {
            if (noticeBanner && noticeText) {
                noticeBanner.style.borderColor = '#f87171';
                noticeBanner.style.color = '#fca5a5';
                noticeText.textContent = data.message || 'Login failed.';
            }
            submitBtn.disabled = false;
            submitBtnText.textContent = `Login as ${ROLE_DETAILS[currentRole].badge}`;
        }
    } catch (err) {
        if (noticeBanner && noticeText) {
            noticeBanner.style.borderColor = '#f87171';
            noticeBanner.style.color = '#fca5a5';
            noticeText.textContent = 'Server connection error. Please try again.';
        }
        submitBtn.disabled = false;
        submitBtnText.textContent = `Login as ${ROLE_DETAILS[currentRole].badge}`;
    }
}

// Handle Forgot Password Click
function handleForgotPassword(event) {
    event.preventDefault();
    const noticeBanner = document.getElementById('notice-banner');
    const noticeText = document.getElementById('notice-text');
    if (noticeBanner && noticeText) {
        noticeBanner.style.borderColor = '#f59e0b';
        noticeBanner.style.color = '#fcd34d';
        noticeText.textContent = `Password reset link will be sent to your registered ${ROLE_DETAILS[currentRole].badge} email. Contact admin@saividya.ac.in if required.`;
    }
}

// Feature Modal Functions
function showFeatureModal(title, description) {
    const modal = document.getElementById('feature-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalDescription = document.getElementById('modal-description');

    if (modal && modalTitle && modalDescription) {
        modalTitle.textContent = title;
        modalDescription.textContent = description;
        modal.classList.add('active');
    }
}

function closeFeatureModal(event) {
    const modal = document.getElementById('feature-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}
