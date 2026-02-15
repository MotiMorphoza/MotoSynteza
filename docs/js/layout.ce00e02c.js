async function loadSidebar() {
  const placeholder = document.querySelector('[data-sidebar]');
  if (!placeholder) return;

  try {
    const res = await fetch('/MotoSynteza/partials/sidebar.html');
    if (!res.ok) throw new Error('Sidebar load failed');
    const html = await res.text();
    placeholder.innerHTML = html;
  } catch (err) {
    console.error('Sidebar error:', err);
  }
}

document.addEventListener('DOMContentLoaded', loadSidebar);
