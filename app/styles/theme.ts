/**
 * CartPulse design system.
 *
 * One stylesheet, injected once in app.tsx, so every page shares the same
 * surfaces, spacing, type scale and states instead of restyling per route.
 *
 * Direction: warm neutral canvas, a single restrained accent, serif display
 * numerals for figures, and uppercase micro-labels — the conventions premium
 * Shopify apps lean on to read as considered rather than busy.
 */
export const APP_CSS = `
:root {
  --ui-canvas: #FAF9F7;
  --ui-surface: #FFFFFF;
  --ui-surface-sunken: #F6F4F0;
  --ui-cream: #FDF9F1;
  --ui-border: #ECE8E1;
  --ui-border-strong: #DFD9CE;

  --ui-ink: #1A1A1A;
  --ui-ink-2: #44423E;
  --ui-muted: #8A8681;
  --ui-faint: #A8A49E;

  --ui-accent: #6C5CE7;
  --ui-accent-hover: #5B4BD6;
  --ui-accent-soft: #EFEDFD;
  --ui-accent-ink: #4A3FB5;

  --ui-success: #15774A;
  --ui-success-soft: #E8F6EE;
  --ui-warn: #9A5B13;
  --ui-warn-soft: #FDF3E4;
  --ui-danger: #B42318;
  --ui-danger-soft: #FEF0EF;

  --ui-r-sm: 10px;
  --ui-r-md: 14px;
  --ui-r-lg: 18px;
  --ui-shadow: 0 1px 2px rgba(26,26,26,.04), 0 6px 20px rgba(26,26,26,.05);
  --ui-shadow-lift: 0 2px 4px rgba(26,26,26,.05), 0 12px 32px rgba(26,26,26,.08);

  --ui-serif: Georgia, "Times New Roman", serif;
}

.ui { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif; color: var(--ui-ink); }
.ui *, .ui *::before, .ui *::after { box-sizing: border-box; }

/* ---------- page header ---------- */
.ui-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 22px; }
.ui-head-left { display: flex; gap: 13px; align-items: flex-start; }
.ui-head-icon { width: 38px; height: 38px; border-radius: var(--ui-r-sm); background: var(--ui-accent-soft);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ui-title { font-size: 22px; font-weight: 700; letter-spacing: -.015em; color: var(--ui-ink); margin: 0 0 3px; }
.ui-sub { font-size: 13.5px; color: var(--ui-muted); margin: 0; line-height: 1.5; }

/* ---------- surfaces ---------- */
.ui-card { background: var(--ui-surface); border: 1px solid var(--ui-border); border-radius: var(--ui-r-lg);
  box-shadow: var(--ui-shadow); overflow: hidden; }
.ui-card-pad { padding: 22px 24px; }
.ui-card-head { padding: 18px 24px; border-bottom: 1px solid var(--ui-border); display: flex;
  align-items: center; justify-content: space-between; gap: 14px; }
.ui-card-title { font-size: 14.5px; font-weight: 650; color: var(--ui-ink); margin: 0; }
.ui-label { font-size: 10.5px; font-weight: 700; letter-spacing: .085em; text-transform: uppercase;
  color: var(--ui-faint); margin: 0 0 12px; }

/* ---------- metrics ---------- */
.ui-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
.ui-kpi { background: var(--ui-surface); border: 1px solid var(--ui-border); border-radius: var(--ui-r-md);
  padding: 18px 20px; box-shadow: var(--ui-shadow); transition: box-shadow .18s ease, transform .18s ease; }
.ui-kpi:hover { box-shadow: var(--ui-shadow-lift); transform: translateY(-1px); }
.ui-kpi-top { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
.ui-kpi-dot { width: 26px; height: 26px; border-radius: 8px; display: flex; align-items: center;
  justify-content: center; flex-shrink: 0; background: var(--ui-accent-soft); }
.ui-kpi-name { font-size: 12px; font-weight: 600; color: var(--ui-muted); margin: 0; }
.ui-kpi-value { font-family: var(--ui-serif); font-size: 30px; font-weight: 700; line-height: 1;
  color: var(--ui-ink); margin: 0; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
.ui-kpi-foot { font-size: 11.5px; color: var(--ui-faint); margin: 7px 0 0; }

/* ---------- table ---------- */
.ui-table { width: 100%; border-collapse: collapse; }
.ui-table th { font-size: 10.5px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase;
  color: var(--ui-faint); padding: 12px 20px; text-align: left; border-bottom: 1px solid var(--ui-border);
  background: var(--ui-surface-sunken); white-space: nowrap; }
.ui-table td { font-size: 13.5px; color: var(--ui-ink-2); padding: 14px 20px;
  border-bottom: 1px solid #F5F2ED; vertical-align: middle; }
.ui-table tbody tr:last-child td { border-bottom: none; }
.ui-table tbody tr { transition: background .12s ease; }
.ui-table tbody tr:hover td { background: #FCFBF9; }
.ui-num { font-variant-numeric: tabular-nums; font-weight: 650; color: var(--ui-ink); }

/* ---------- badges ---------- */
.ui-badge { display: inline-flex; align-items: center; gap: 5px; border-radius: 999px; padding: 3px 10px;
  font-size: 11px; font-weight: 650; white-space: nowrap; }
.ui-badge-success { background: var(--ui-success-soft); color: var(--ui-success); }
.ui-badge-warn { background: var(--ui-warn-soft); color: var(--ui-warn); }
.ui-badge-danger { background: var(--ui-danger-soft); color: var(--ui-danger); }
.ui-badge-accent { background: var(--ui-accent-soft); color: var(--ui-accent-ink); }
.ui-badge-quiet { background: var(--ui-surface-sunken); color: var(--ui-muted); }

/* ---------- buttons ---------- */
.ui-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: none;
  border-radius: var(--ui-r-sm); padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
  font-family: inherit; background: var(--ui-accent); color: #fff; transition: background .15s ease; }
.ui-btn:hover { background: var(--ui-accent-hover); }
.ui-btn:disabled { opacity: .5; cursor: not-allowed; }
.ui-btn-ghost { background: var(--ui-surface); color: var(--ui-ink-2); border: 1px solid var(--ui-border-strong); }
.ui-btn-ghost:hover { background: var(--ui-surface-sunken); }
.ui-btn-danger { background: var(--ui-surface); color: var(--ui-danger); border: 1px solid #F3C9C5; }
.ui-btn-danger:hover { background: var(--ui-danger-soft); }

/* ---------- pieces ---------- */
.ui-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--ui-accent-soft);
  color: var(--ui-accent-ink); display: flex; align-items: center; justify-content: center;
  font-size: 11.5px; font-weight: 700; flex-shrink: 0; }
.ui-empty { padding: 62px 24px; text-align: center; }
.ui-empty-icon { width: 54px; height: 54px; border-radius: var(--ui-r-md); background: var(--ui-surface-sunken);
  display: flex; align-items: center; justify-content: center; margin: 0 auto 15px; }
.ui-empty-title { font-size: 15px; font-weight: 650; color: var(--ui-ink); margin: 0 0 5px; }
.ui-empty-text { font-size: 13px; color: var(--ui-muted); margin: 0; }
.ui-foot { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px;
  color: var(--ui-faint); margin: 22px 0 0; }
.ui-bar { border-radius: 5px 5px 0 0; background: linear-gradient(180deg, var(--ui-accent), #9B8FF2);
  transition: height .45s cubic-bezier(.4,0,.2,1); }
.ui-bar-empty { background: var(--ui-surface-sunken); }
.ui-meter { height: 8px; background: var(--ui-surface-sunken); border-radius: 999px; overflow: hidden; }
.ui-meter > div { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--ui-success), #4FBE8B);
  transition: width .6s cubic-bezier(.4,0,.2,1); }
.ui-trunc { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 880px) { .ui-grid-2 { grid-template-columns: 1fr; } }

/* ---------- confirm dialog ---------- */
.ui-overlay { position: fixed; inset: 0; background: rgba(26,26,26,.45); display: flex;
  align-items: center; justify-content: center; padding: 20px; z-index: 2147482000;
  animation: ui-fade-in .16s ease; }
.ui-dialog { background: var(--ui-surface); border-radius: var(--ui-r-lg); width: 100%; max-width: 420px;
  box-shadow: 0 24px 60px rgba(0,0,0,.26); overflow: hidden; animation: ui-pop-in .19s cubic-bezier(.2,.9,.3,1.2); }
.ui-dialog-body { padding: 24px 24px 18px; display: flex; gap: 14px; }
.ui-dialog-icon { width: 38px; height: 38px; border-radius: 50%; background: var(--ui-danger-soft);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ui-dialog-title { font-size: 15.5px; font-weight: 650; color: var(--ui-ink); margin: 0 0 5px; }
.ui-dialog-text { font-size: 13.5px; color: var(--ui-muted); margin: 0; line-height: 1.55; }
.ui-dialog-foot { display: flex; justify-content: flex-end; gap: 9px; padding: 14px 24px 20px; }

@keyframes ui-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ui-pop-in { from { opacity: 0; transform: translateY(10px) scale(.97); }
  to { opacity: 1; transform: translateY(0) scale(1); } }

/* ---------- row removal ---------- */
.ui-row-removing td { background: var(--ui-danger-soft) !important; }
.ui-row-removing { animation: ui-row-out .34s cubic-bezier(.4,0,.6,1) forwards; }
@keyframes ui-row-out {
  30%  { opacity: .55; transform: translateX(-6px); }
  100% { opacity: 0; transform: translateX(-28px); }
}

/* ---------- toast ---------- */
.ui-toast-wrap { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%);
  z-index: 2147482500; pointer-events: none; }
.ui-toast { display: flex; align-items: center; gap: 10px; background: #1F1E1C; color: #fff;
  border-radius: 999px; padding: 11px 20px 11px 14px; font-size: 13.5px; font-weight: 550;
  box-shadow: 0 10px 34px rgba(0,0,0,.3); animation: ui-toast-in .28s cubic-bezier(.2,.9,.3,1.25); }
.ui-toast.leaving { animation: ui-toast-out .22s ease forwards; }
.ui-toast-mark { width: 21px; height: 21px; border-radius: 50%; background: var(--ui-success);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ui-toast-mark.danger { background: var(--ui-danger); }
.ui-toast-mark svg { animation: ui-draw .3s ease .08s both; }

@keyframes ui-toast-in { from { opacity: 0; transform: translateY(16px) scale(.94); }
  to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes ui-toast-out { to { opacity: 0; transform: translateY(10px) scale(.96); } }
@keyframes ui-draw { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }

/* ---------- saving / saved button states ---------- */
.ui-btn .ui-spin { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.4);
  border-top-color: #fff; border-radius: 50%; animation: ui-spin .6s linear infinite; }
@keyframes ui-spin { to { transform: rotate(360deg); } }
.ui-btn-saved { background: var(--ui-success) !important; animation: ui-pulse .4s ease; }
@keyframes ui-pulse { 0% { transform: scale(1); } 45% { transform: scale(1.045); } 100% { transform: scale(1); } }

@media (prefers-reduced-motion: reduce) {
  .ui-dialog, .ui-overlay, .ui-toast, .ui-row-removing, .ui-btn-saved, .ui-bar, .ui-meter > div {
    animation: none !important; transition: none !important;
  }
}
`;
