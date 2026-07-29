// app/page.tsx (or pages/index.tsx — works for both App Router and Pages Router)
// Place this file at: app/page.tsx
// Fonts: add to app/layout.tsx → import { Playfair_Display, Inter, JetBrains_Mono } from 'next/font/google'

"use client";

import { useEffect, useRef, useState } from "react";

// ─── TYPES ──────────────────────────────────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface OrbitNode {
  label: string;
  icon: string;
  angle: number;
  speed: number;
  radius: number;
  color: string;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const AUTH_URL = "/api/auth/login"; // ← replace with your actual auth URL


const ORBIT_NODES = [
  { label: "Notion",    icon: "□", color: "#C47A2B", radius: 160, angle: (0 / 7) * Math.PI * 2, speed: 0.003 },
  { label: "Drive",     icon: "△",  color: "#C47A2B", radius: 160, angle: (1 / 7) * Math.PI * 2, speed: 0.003 },
  { label: "Calendar",  icon: "◫", color: "#C47A2B", radius: 160, angle: (2 / 7) * Math.PI * 2, speed: 0.003 },
  { label: "GitHub",    icon: "⌥",  color: "#C47A2B", radius: 160, angle: (3 / 7) * Math.PI * 2, speed: 0.003 },
  { label: "Gmail",     icon: "✉",  color: "#C47A2B", radius: 160, angle: (4 / 7) * Math.PI * 2, speed: 0.003 },
  { label: "Atlassian", icon: "◈",  color: "#C47A2B", radius: 160, angle: (5 / 7) * Math.PI * 2, speed: 0.003 },
  { label: "Slack",     icon: "#",  color: "#C47A2B", radius: 160, angle: (6 / 7) * Math.PI * 2, speed: 0.003 },
  { label: "Sheets",     icon: "▦",  color: "#C47A2B", radius: 160, angle: (6 / 7) * Math.PI * 2, speed: 0.003 },
];

const FEATURES = [
  {
    eyebrow: "External Connectors",
    title: "Every tool you use, unified",
    body: "Orphic connects natively to GitHub, Gmail, Slack, Notion, Google Drive, Sheets, Calendar, and Atlassian — not via brittle scraping, but through official MCP protocols. Real actions, real data.",
    code: `// Orphic resolves your token and calls the tool
await execute_mcp_tool("github", "create_pull_request", {
  title: "feat: add dark mode",
  base: "main"
})`,
  },
  {
    eyebrow: "Workflow Automation",
    title: "Describe it. Orphic builds it.",
    body: "Tell Orphic what you want automated in plain language. It drafts the workflow, validates it, asks for your approval — then publishes it and runs it. No JSON. No drag-and-drop.",
    code: `// Orphic constructs and publishes the workflow
"When a GitHub PR is merged, post a summary 
 to Slack and update the Notion project board"
→ ✓ Workflow created (3 nodes) — Approve?`,
  },
  {
    eyebrow: "Autonomous Agents",
    title: "Agents that interrupt, not just execute",
    body: "When Orphic needs access to a service you haven't connected yet, it pauses, asks for permission, then resumes exactly where it left off. Human-in-the-loop isn't an afterthought — it's the architecture.",
    code: `// HITL interrupt + resume
{ type: "interrupt", provider: "notion",
  auth_url: "https://orphic.me/auth/notion" }
// User approves →
POST /chat/resume/{thread_id} { action: "continue" }`,
  },
];

const CONNECTORS = [
  { name: "GitHub",    color: "#C47A2B", desc: "Repos, PRs, Issues" },
  { name: "Gmail",     color: "#7C4A1E", desc: "Read, send, organize" },
  { name: "Slack",     color: "#C47A2B", desc: "Messages & channels" },
  { name: "Notion",    color: "#7C4A1E", desc: "Pages & databases" },
  { name: "Drive",     color: "#C47A2B", desc: "Files & folders" },
  { name: "Sheets",    color: "#7C4A1E", desc: "Data & formulas" },
  { name: "Calendar",  color: "#C47A2B", desc: "Events & scheduling" },
  { name: "Atlassian", color: "#7C4A1E", desc: "Jira + Confluence" },
];

// ─── ORBIT CANVAS ────────────────────────────────────────────────────────────
function OrbitCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<OrbitNode[]>(ORBIT_NODES.map(n => ({ ...n })));
  const frameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const pulseRef = useRef(0);
  const isRunning = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      if (width === 0 || height === 0) return;
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    setTimeout(resize, 0);
    window.addEventListener("resize", resize);

    const w = () => canvas.offsetWidth;
    const h = () => canvas.offsetHeight;

    const spawnParticle = (x: number, y: number, color: string) => {
      if (particlesRef.current.length > 60) return;
      const angle = Math.random() * Math.PI * 2;
      particlesRef.current.push({
        x, y,
        vx: Math.cos(angle) * (0.3 + Math.random() * 0.5),
        vy: Math.sin(angle) * (0.3 + Math.random() * 0.5),
        life: 0,
        maxLife: 60 + Math.random() * 40,
        size: 1 + Math.random() * 2,
      });
    };

    isRunning.current = true;

    const draw = () => {
      if (!isRunning.current) return;

      ctx.clearRect(0, 0, w(), h());
      const cx = w() / 2;
      const cy = h() / 2;
      pulseRef.current += 0.02;

      // Ambient glow rings
      for (let r = 1; r <= 3; r++) {
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 45 * r);
        grd.addColorStop(0, `rgba(196,122,43,${0.06 / r})`);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(cx, cy, 45 * r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Core pulse
      const pulse = Math.sin(pulseRef.current) * 0.2 + 0.8;
      const corePulse = ctx.createRadialGradient(cx, cy, 0, cx, cy, 38 * pulse);
      corePulse.addColorStop(0, "rgba(196,122,43,0.9)");
      corePulse.addColorStop(0.4, "rgba(124,74,30,0.6)");
      corePulse.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = corePulse;
      ctx.beginPath();
      ctx.arc(cx, cy, 38 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Core circle
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(196,122,43,0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#1A1108";
      ctx.fill();
      ctx.fillStyle = "#E8D5B0";
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ORPHIC", cx, cy);

      // Update and draw nodes
      // Replace node.angle += node.speed with fixed spacing
      nodesRef.current.forEach((node, i) => {
        node.angle += node.speed;  // 
        const fixedAngle = (i / nodesRef.current.length) * Math.PI * 2;
        const nx = cx + Math.cos(node.angle) * node.radius;
        const ny = cy + Math.sin(node.angle) * node.radius;

        // Connector line
        const lineGrd = ctx.createLinearGradient(cx, cy, nx, ny);
        lineGrd.addColorStop(0, "rgba(196,122,43,0.3)");
        lineGrd.addColorStop(0.5, `${node.color}55`);
        lineGrd.addColorStop(1, "rgba(196,122,43,0.1)");
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = lineGrd;
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Travelling dot — offset per node so they don't all sync
        const t = ((Date.now()) % 2000) / 2000;
        const dotX = cx + Math.cos(node.angle) * node.radius * t;
        const dotY = cy + Math.sin(node.angle) * node.radius * t;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Spawn particle at node position
        if (Math.random() < 0.015) spawnParticle(nx, ny, node.color);

        // Node circle
        ctx.beginPath();
        ctx.arc(nx, ny, 18, 0, Math.PI * 2);
        ctx.fillStyle = "#1A1108";
        ctx.fill();
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Node label below
        ctx.fillStyle = "#E8D5B0";
        ctx.font = "9px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.label, nx, ny + 28);
        ctx.font = "12px sans-serif";
        ctx.fillText(node.icon, nx, ny);
      });

      // Particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        const alpha = 1 - p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0, p.size * alpha), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(196,122,43,${alpha * 0.6})`;
        ctx.fill();
        return p.life < p.maxLife;
      });

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      isRunning.current = false;
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}

// ─── CODE BLOCK ──────────────────────────────────────────────────────────────
function CodeBlock({ code }: { code: string }) {
  const lines = code.trim().split("\n");
  return (
    <div style={{
      background: "#0A0805",
      border: "1px solid #6B4A28",
      borderRadius: "8px",
      padding: "16px 20px",
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      fontSize: "12px",
      lineHeight: "1.7",
      overflowX: "auto",
      position: "relative",
    }}>
      <div style={{
        display: "flex",
        gap: "6px",
        marginBottom: "12px",
        opacity: 0.4,
      }}>
        {["#ff5f57","#febc2e","#28c840"].map(c => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
        ))}
      </div>
      {lines.map((line, i) => {
        const isComment = line.trim().startsWith("//") || line.trim().startsWith("#");
        const isKey = line.includes('"type"') || line.includes("await ") || line.includes("POST ");
        const isArrow = line.includes("→");
        return (
          <div key={i} style={{
            color: isComment ? "#7A5C3A" : isArrow ? "#C47A2B" : isKey ? "#E8D5B0" : "#C4A882",
            whiteSpace: "pre",
          }}>{line || " "}</div>
        );
      })}
    </div>
  );
}

// ─── ANIMATED COUNTER ────────────────────────────────────────────────────────
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      let start = 0;
      const step = target / 60;
      const t = setInterval(() => {
        start = Math.min(start + step, target);
        setVal(Math.floor(start));
        if (start >= target) clearInterval(t);
      }, 16);
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [target]);
  return <div ref={ref}>{val}{suffix}</div>;
}

// ─── SCROLL REVEAL ────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

// ─── MAIN LANDING PAGE ───────────────────────────────────────────────────────
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  // Inject Google Fonts
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  const styles: Record<string, React.CSSProperties> = {
    root: {
      background: "#0A0805",
      color: "#E8D5B0",
      minHeight: "100vh",
      fontFamily: "'Inter', sans-serif",
      overflowX: "hidden",
    },

    // NAV
    nav: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "20px 48px",
      background: "rgba(10,8,5,0.85)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(61,32,16,0.4)",
    },
    navLogo: {
      fontFamily: "'Playfair Display', serif",
      fontSize: "22px",
      fontWeight: 700,
      color: "#C47A2B",
      letterSpacing: "0.08em",
      textDecoration: "none",
    },
    navLinks: {
      display: "flex",
      gap: "36px",
      listStyle: "none",
      margin: 0,
      padding: 0,
    },
    navLink: {
      color: "#C4A882",
      textDecoration: "none",
      fontSize: "14px",
      fontWeight: 400,
      letterSpacing: "0.04em",
      transition: "color 0.2s",
    },
    navCta: {
      background: "linear-gradient(135deg, #C47A2B, #7C4A1E)",
      color: "#E8D5B0",
      border: "none",
      padding: "10px 24px",
      borderRadius: "6px",
      fontSize: "14px",
      fontWeight: 500,
      cursor: "pointer",
      textDecoration: "none",
      transition: "opacity 0.2s, transform 0.2s",
      display: "inline-block",
    },

    // HERO
    hero: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
      paddingTop: "80px",
    },
    heroGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      alignItems: "center",
      gap: "64px",
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "0 48px",
      width: "100%",
    },
    heroEyebrow: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "11px",
      fontWeight: 500,
      letterSpacing: "0.18em",
      textTransform: "uppercase" as const,
      color: "#C47A2B",
      marginBottom: "20px",
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    heroTitle: {
      fontFamily: "'Playfair Display', serif",
      fontSize: "clamp(40px, 5vw, 72px)",
      fontWeight: 900,
      lineHeight: 1.05,
      marginBottom: "24px",
      letterSpacing: "-0.02em",
    },
    heroCoffee: {
      color: "#C47A2B",
      fontStyle: "italic",
    },
    heroSub: {
      fontSize: "17px",
      lineHeight: 1.7,
      color: "#C4A882",
      marginBottom: "40px",
      maxWidth: "480px",
    },
    heroActions: {
      display: "flex",
      gap: "16px",
      alignItems: "center",
      flexWrap: "wrap" as const,
    },
    btnPrimary: {
      background: "linear-gradient(135deg, #C47A2B 0%, #7C4A1E 100%)",
      color: "#E8D5B0",
      border: "none",
      padding: "16px 36px",
      borderRadius: "8px",
      fontSize: "16px",
      fontWeight: 600,
      cursor: "pointer",
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      transition: "transform 0.2s, box-shadow 0.2s",
      boxShadow: "0 4px 24px rgba(196,122,43,0.3)",
      letterSpacing: "0.02em",
    },
    btnSecondary: {
      background: "transparent",
      color: "#C4A882",
      border: "1px solid #6B4A28",
      padding: "16px 28px",
      borderRadius: "8px",
      fontSize: "15px",
      cursor: "pointer",
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      transition: "border-color 0.2s, color 0.2s",
    },

    // CANVAS
    canvasWrap: {
      height: "480px",
      position: "relative",
    },

    // STATS
    stats: {
      borderTop: "1px solid #1A1108",
      borderBottom: "1px solid #1A1108",
      padding: "40px 0",
      background: "#0D0A06",
    },
    statsGrid: {
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "0 48px",
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "0",
    },
    statItem: {
      textAlign: "center" as const,
      padding: "20px",
      borderRight: "1px solid #1A1108",
    },
    statNum: {
      fontFamily: "'Playfair Display', serif",
      fontSize: "42px",
      fontWeight: 900,
      color: "#C47A2B",
      lineHeight: 1,
      marginBottom: "8px",
    },
    statLabel: {
      fontSize: "13px",
      color: "#7A5C3A",
      letterSpacing: "0.06em",
      textTransform: "uppercase" as const,
      fontFamily: "'JetBrains Mono', monospace",
    },

    // SECTION
    section: {
      maxWidth: "1200px",
      margin: "0 auto",
      padding: "100px 48px",
    },
    sectionEyebrow: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "11px",
      letterSpacing: "0.16em",
      textTransform: "uppercase" as const,
      color: "#7C4A1E",
      marginBottom: "16px",
    },
    sectionTitle: {
      fontFamily: "'Playfair Display', serif",
      fontSize: "clamp(28px, 4vw, 48px)",
      fontWeight: 700,
      lineHeight: 1.1,
      marginBottom: "48px",
      letterSpacing: "-0.01em",
    },

    // FEATURES
    featureRow: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "64px",
      alignItems: "center",
      marginBottom: "100px",
    },
    featureRowReverse: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "64px",
      alignItems: "center",
      marginBottom: "100px",
      direction: "rtl" as const,
    },
    featureLtr: {
      direction: "ltr" as const,
    },
    featureEyebrow: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: "10px",
      letterSpacing: "0.2em",
      textTransform: "uppercase" as const,
      color: "#C47A2B",
      marginBottom: "12px",
    },
    featureTitle: {
      fontFamily: "'Playfair Display', serif",
      fontSize: "clamp(22px, 3vw, 36px)",
      fontWeight: 700,
      lineHeight: 1.15,
      marginBottom: "16px",
    },
    featureBody: {
      fontSize: "15px",
      lineHeight: 1.75,
      color: "#A8845A",
      marginBottom: "24px",
    },

    // CONNECTORS GRID
    connectorsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "16px",
    },
    connectorCard: {
      background: "#0D0A06",
      border: "1px solid #1A1108",
      borderRadius: "10px",
      padding: "20px",
      transition: "border-color 0.25s, transform 0.25s",
      cursor: "default",
    },
    connectorDot: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      marginBottom: "12px",
    },
    connectorName: {
      fontSize: "14px",
      fontWeight: 600,
      marginBottom: "4px",
      color: "#E8D5B0",
    },
    connectorDesc: {
      fontSize: "12px",
      color: "#7A5C3A",
      fontFamily: "'JetBrains Mono', monospace",
    },

    // HOW IT WORKS
    howGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "32px",
    },
    howCard: {
      background: "#0D0A06",
      border: "1px solid #1A1108",
      borderRadius: "12px",
      padding: "32px",
      position: "relative" as const,
    },
    howNumber: {
      fontFamily: "'Playfair Display', serif",
      fontSize: "48px",
      fontWeight: 900,
      color: "#1A1108",
      lineHeight: 1,
      marginBottom: "16px",
    },
    howTitle: {
      fontFamily: "'Playfair Display', serif",
      fontSize: "20px",
      fontWeight: 700,
      marginBottom: "12px",
      color: "#E8D5B0",
    },
    howBody: {
      fontSize: "14px",
      lineHeight: 1.7,
      color: "#7A5C3A",
    },
    howAccent: {
      width: 32,
      height: 2,
      background: "linear-gradient(90deg, #C47A2B, transparent)",
      marginBottom: "20px",
    },

    // CTA
    ctaSection: {
      background: "#0D0A06",
      borderTop: "1px solid #1A1108",
      borderBottom: "1px solid #1A1108",
    },
    ctaInner: {
      maxWidth: "760px",
      margin: "0 auto",
      padding: "100px 48px",
      textAlign: "center" as const,
    },
    ctaTitle: {
      fontFamily: "'Playfair Display', serif",
      fontSize: "clamp(32px, 5vw, 60px)",
      fontWeight: 900,
      lineHeight: 1.1,
      marginBottom: "20px",
      letterSpacing: "-0.02em",
    },
    ctaSub: {
      fontSize: "16px",
      color: "#A8845A",
      marginBottom: "40px",
      lineHeight: 1.6,
    },

    // FOOTER
    footer: {
      padding: "48px",
      maxWidth: "1200px",
      margin: "0 auto",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    },
    footerLogo: {
      fontFamily: "'Playfair Display', serif",
      fontSize: "18px",
      color: "#6B4A28",
      fontWeight: 700,
    },
    footerText: {
      fontSize: "13px",
      color: "#5A3A1E",
      fontFamily: "'JetBrains Mono', monospace",
    },

    // BG grain overlay
    grain: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: "none" as const,
      zIndex: 0,
      opacity: 0.03,
      backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      backgroundRepeat: "repeat",
    },
  };

  return (
    <div style={styles.root}>
      {/* Grain texture */}
      <div style={styles.grain} aria-hidden />

      {/* ── NAV ── */}
      <nav style={styles.nav}>
        <a href="/" style={styles.navLogo}>Orphic AI</a>
        <ul style={styles.navLinks}>
          {["Features", "Connectors", "How it works"].map(l => (
            <li key={l}>
              <a
                href={`#${l.toLowerCase().replace(/ /g, "-")}`}
                style={styles.navLink}
                onMouseEnter={e => ((e.target as HTMLElement).style.color = "#C47A2B")}
                onMouseLeave={e => ((e.target as HTMLElement).style.color = "#C4A882")}
              >{l}</a>
            </li>
          ))}
        </ul>
        <a
          href={AUTH_URL}
          style={styles.navCta}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.opacity = "0.85";
            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          }}
        >
          Get Started
        </a>
      </nav>

      {/* ── HERO ── */}
      <section style={styles.hero}>
        {/* Radial bg glow */}
        <div style={{
          position: "absolute",
          top: "40%",
          right: "10%",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,74,30,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{ ...styles.heroGrid, position: "relative", zIndex: 1 }}>
          <div>
            <Reveal>
              <div style={styles.heroEyebrow}>
                <span style={{
                  display: "inline-block",
                  width: 28,
                  height: 1,
                  background: "#C47A2B",
                  verticalAlign: "middle",
                }} />
                AI Agent Platform
              </div>
              <h1 style={styles.heroTitle}>
                Do Beyond<br />
                <span style={styles.heroCoffee}>Ordinary.</span>
              </h1>
              <p style={styles.heroSub}>
                Orphic connects to every app you rely on and lets AI agents 
                automate your workflows — with human approval built into the loop,
                not bolted on as an afterthought.
              </p>
              <div style={styles.heroActions}>
                <a
                  href={AUTH_URL}
                  style={styles.btnPrimary}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(196,122,43,0.4)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(196,122,43,0.3)";
                  }}
                >
                  Get Started
                  <span style={{ fontSize: "18px" }}>→</span>
                </a>
                <a
                  href="#features"
                  style={styles.btnSecondary}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#7C4A1E";
                    (e.currentTarget as HTMLElement).style.color = "#E8D5B0";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#6B4A28";
                    (e.currentTarget as HTMLElement).style.color = "#C4A882";
                  }}
                >
                  See how it works
                </a>
              </div>
            </Reveal>
          </div>

          {/* Orbit animation */}
          <Reveal delay={200}>
            <div style={styles.canvasWrap}>
              <OrbitCanvas />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── STATS ── */}
      <div style={styles.stats}>
        <div style={styles.statsGrid}>
          {[
            { target: 8, suffix: "+", label: "Live connectors" },
            { target: 50, suffix: "k", label: "Tokens / hr" },
            { target: 3, suffix: "s", label: "Avg response" },
            { target: 99, suffix: "%", label: "Uptime SLA" },
          ].map((s, i) => (
            <Reveal delay={i * 80} key={s.label}>
              <div style={{ ...styles.statItem, borderRight: i < 3 ? "1px solid #1A1108" : "none" }}>
                <div style={styles.statNum}>
                  <Counter target={s.target} suffix={s.suffix} />
                </div>
                <div style={styles.statLabel}>{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div id="features">
        <div style={styles.section}>
          <Reveal>
            <div style={styles.sectionEyebrow}>Capabilities</div>
            <div style={styles.sectionTitle}>
              What Orphic agents<br />actually do
            </div>
          </Reveal>

          {FEATURES.map((f, i) => (
            <Reveal delay={100} key={f.eyebrow}>
              <div style={i % 2 === 0 ? styles.featureRow : styles.featureRowReverse}>
                <div style={i % 2 !== 0 ? styles.featureLtr : {}}>
                  <div style={styles.featureEyebrow}>{f.eyebrow}</div>
                  <h3 style={styles.featureTitle}>{f.title}</h3>
                  <p style={styles.featureBody}>{f.body}</p>
                </div>
                <div style={i % 2 !== 0 ? styles.featureLtr : {}}>
                  <CodeBlock code={f.code} />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* ── CONNECTORS ── */}
      <div id="connectors" style={{ background: "#080603" }}>
        <div style={styles.section}>
          <Reveal>
            <div style={styles.sectionEyebrow}>External Connectors</div>
            <div style={styles.sectionTitle}>
              Your stack, already<br />speaking Orphic
            </div>
          </Reveal>
          <div style={styles.connectorsGrid}>
            {CONNECTORS.map((c, i) => (
              <Reveal delay={i * 50} key={c.name}>
                <div
                  style={styles.connectorCard}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = c.color + "60";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#1A1108";
                    (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ ...styles.connectorDot, background: c.color }} />
                  <div style={styles.connectorName}>{c.name}</div>
                  <div style={styles.connectorDesc}>{c.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <p style={{
              marginTop: "32px",
              fontSize: "13px",
              color: "#C4A882",
              fontFamily: "'JetBrains Mono', monospace",
              textAlign: "center",
            }}>
              All via official MCP streamable_http — no brittle scraping, no API key juggling
            </p>
          </Reveal>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div id="how-it-works">
        <div style={styles.section}>
          <Reveal>
            <div style={styles.sectionEyebrow}>How it works</div>
            <div style={styles.sectionTitle}>
              From plain English<br />to running automation
            </div>
          </Reveal>
          <div style={styles.howGrid}>
            {[
              {
                n: "01",
                title: "Connect your apps",
                body: "Authorize Orphic once via OAuth. It stores your tokens securely and handles refresh automatically.",
              },
              {
                n: "02",
                title: "Describe the task",
                body: "Type what you want done. Orphic's agent reasons over your connected services and builds a plan.",
              },
              {
                n: "03",
                title: "Approve and run",
                body: "Before any workflow goes live, Orphic asks for your sign-off. Then it executes, monitors, and reports back.",
              },
            ].map((s, i) => (
              <Reveal delay={i * 120} key={s.n}>
                <div style={styles.howCard}>
                  <div style={styles.howNumber}>{s.n}</div>
                  <div style={styles.howAccent} />
                  <div style={styles.howTitle}>{s.title}</div>
                  <div style={styles.howBody}>{s.body}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <div style={styles.ctaSection}>
        <div style={styles.ctaInner}>
          <Reveal>
            <div style={{
              ...styles.sectionEyebrow,
              textAlign: "center",
              marginBottom: "20px",
            }}>
              Ready to automate
            </div>
            <h2 style={styles.ctaTitle}>
              Stop doing manually<br />what agents can do<br />
              <span style={{ color: "#C47A2B", fontStyle: "italic" }}>permanently.</span>
            </h2>
            <p style={styles.ctaSub}>
              Orphic is in early access. Connect your first app and run your first 
              automated workflow in under 5 minutes.
            </p>
            <a
              href={AUTH_URL}
              style={{
                ...styles.btnPrimary,
                fontSize: "18px",
                padding: "18px 48px",
                borderRadius: "10px",
                display: "inline-flex",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px) scale(1.02)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(196,122,43,0.45)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0) scale(1)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(196,122,43,0.3)";
              }}
            >
              Get Started — it&apos;s free
              <span style={{ fontSize: "20px" }}>→</span>
            </a>
          </Reveal>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer>
        <div style={styles.footer}>
          <div style={styles.footerLogo}>Orphic</div>
          <div style={styles.footerText}>
            © {new Date().getFullYear()} Orphic · Do Beyond Ordinary
          </div>
        </div>
      </footer>
    </div>
  );
}