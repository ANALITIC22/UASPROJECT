/* ── CONFIGURACIÓN SUPABASE (desde config centralizada) ── */
const SUPABASE_URL  = APP_CONFIG.supabase.url;
const SUPABASE_ANON = APP_CONFIG.supabase.anon;

/* ── LÓGICA DE PESTAÑAS ── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const target = this.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    this.classList.add('active');
    const panel = document.getElementById(target);
    if (panel) panel.classList.add('active');
  });
});

/* ── ARRANQUE ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ClientView.init());
} else {
  ClientView.init();
}
