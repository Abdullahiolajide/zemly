import fs from 'fs';
let c = fs.readFileSync('src/components/CreateNoteModals.tsx', 'utf8');

// The main background
c = c.replace(/background: 'rgba\\(16, 18, 24, 0.97\\)'/g, "background: 'var(--bg-main)'");
c = c.replace(/border: '1px solid rgba\\(255,255,255,0.08\\)'/g, "border: '1px solid var(--border-glass-strong)'");
c = c.replace(/boxShadow: '0 24px 80px rgba\\(0,0,0,0.7\\)'/g, "boxShadow: '0 24px 64px rgba(0,0,0,0.15)'");

// Hover backgrounds / borders
// We replace 'rgba(255,255,255,XX)' with css variables to properly adapt to light mode
c = c.replace(/'rgba\(255,255,255,0.02\)'/g, "'var(--bg-glass-hover)'");
c = c.replace(/'rgba\(255,255,255,0.03\)'/g, "'var(--bg-glass-hover)'");
c = c.replace(/'rgba\(255,255,255,0.04\)'/g, "'var(--bg-glass-hover)'");
c = c.replace(/'rgba\(255,255,255,0.05\)'/g, "'var(--bg-glass-hover)'");
c = c.replace(/'rgba\(255,255,255,0.06\)'/g, "'var(--border-glass)'");
c = c.replace(/'rgba\(255,255,255,0.08\)'/g, "'var(--border-glass)'");

// We should also replace the custom colors in icons if they are problematic.
// Like rgba(245,166,35,0.1) -> this is orange, it looks fine in both.
// text-zinc-100 will fall back to #1A1A18 in light mode because of the global css override I found!
// The global index.css has `html.light .text-zinc-100 { color: #1A1A18 !important; }`
// So leaving `text-zinc-100` isn't causing issues, they simply were drawn on the wrong dark background.

fs.writeFileSync('src/components/CreateNoteModals.tsx', c);
