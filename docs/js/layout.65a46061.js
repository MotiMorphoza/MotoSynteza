async function loadSidebar() {
  const placeholder = document.querySelector('[data-sidebar]');
  if (!placeholder) return;

  const response = await fetch('sidebar.html');
  const html = await response.text();
  placeholder.innerHTML = html;

  setActiveNav();
}

function setActiveNav() {
  const current = document.body.dataset.page;
  if (!current) return;

  const link = document.querySelector(`[data-nav="${current}"]`);
  if (link) link.setAttribute('aria-current', 'page');
}

document.addEventListener('DOMContentLoaded', loadSidebar);
