document.addEventListener('DOMContentLoaded', () => {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const sidebarDrawer = document.getElementById('sidebar-drawer');
  const sidebarCloseBtn = document.getElementById('sidebar-close-btn');

  function openSidebar() {
    hamburgerBtn.setAttribute('data-open', 'true');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    sidebarOverlay.setAttribute('data-open', 'true');
    sidebarDrawer.setAttribute('data-open', 'true');
    sidebarDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    hamburgerBtn.setAttribute('data-open', 'false');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    sidebarOverlay.setAttribute('data-open', 'false');
    sidebarDrawer.setAttribute('data-open', 'false');
    sidebarDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
      const isOpen = hamburgerBtn.getAttribute('data-open') === 'true';
      if (isOpen) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }

  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', closeSidebar);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const isOpen = hamburgerBtn?.getAttribute('data-open') === 'true';
      if (isOpen) {
        closeSidebar();
      }
    }
  });

  const sidebarNavMonths = sidebarDrawer?.querySelectorAll('.sidebar-nav-month');
  sidebarNavMonths?.forEach(link => {
    link.addEventListener('click', () => {
      closeSidebar();
    });
  });
});
