// src/onboard.tsx
import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import { readBinaryFile, exists } from "@tauri-apps/api/fs";
import { join } from "@tauri-apps/api/path";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Grid,
  Settings,
  LogOut,
  Play,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import "./App.css";

/* -------------------- Helpers -------------------- */
function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null as any, bytes.subarray(i, i + chunk) as any);
  }
  return btoa(binary);
}
function getFolderName(p: string) {
  const parts = p.split(/\\|\//).filter(Boolean);
  return parts[parts.length - 1] || p;
}

/* -------------------- Types -------------------- */
type TabKey = "home" | "library" | "news" | "settings";
type BuildItem = { id: string; path: string; name: string; coverDataUrl?: string };
type NewsItem = { id: string; title: string; date: string; desc: string; img?: string };
/* -------------------- Component -------------------- */
export default function Onboard() {
  const navigate = useNavigate();

  // preserved states / logic
  const [active, setActive] = useState<TabKey>("home");
  const [path, setPath] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [user, setUser] = useState<{ email: string; password: string } | null>(null);
  const [EOR, setEOR] = useState(false);
  const [builds, setBuilds] = useState<BuildItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // mock news / hero carousel images (swap as you like)
  const [news] = useState<NewsItem[]>([
    { id: "n1", title: "Patch v2.5 — Performance & polish", date: "Oct 12, 2025", desc: "Performance improvements + UI polish. Read full patch notes in the launcher.", img: "https://i.ibb.co/HLQqKrj4/Chapter-2-Remix-Header.webp" },
    { id: "n2", title: "Matchmaking improvements", date: "Oct 9, 2025", desc: "We've fixed several issues and improved matchmaking stability.", img: "https://i.ibb.co/yBBpHp1D/Chapter-2-Season-4-Key-Art-Fortnite.webp" },
    { id: "n3", title: "Scheduled Maintenance", date: "Oct 7, 2025", desc: "Servers will be down for 3 hours for backend updates.", img: "https://i.ibb.co/DDsGMMyh/hq720.jpg" },
  ]);

  /* -------------------- lifecycle / persistence -------------------- */
  useEffect(() => {
    const savedPath = localStorage.getItem("buildPath");
    if (savedPath) setPath(savedPath);

    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ }
    }

    const rawEOR = localStorage.getItem("EOR");
    if (rawEOR !== null) setEOR(rawEOR === "true");

    const savedBuilds = localStorage.getItem("ProjectMP.builds");
    if (savedBuilds) {
      try {
        const parsed = JSON.parse(savedBuilds) as BuildItem[];
        setBuilds(parsed);
        if (!savedPath && parsed.length > 0) setPath(parsed[0].path);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ProjectMP.builds", JSON.stringify(builds));
  }, [builds]);

  useEffect(() => {
    if (path) localStorage.setItem("buildPath", path); else localStorage.removeItem("buildPath");
  }, [path]);

  /* -------------------- launcher polling -------------------- */
  useEffect(() => {
    let cancelled = false;
    let t: number | null = null;
    const run = async () => {
      try {
        const r = await invoke("is_fortnite_client_running");
        if (!cancelled && r === false) setIsLaunching(false);
      } catch {
        if (!cancelled) setIsLaunching(false);
      }
    };
    if (isLaunching) {
      run();
      t = window.setInterval(run, 3000);
    }
    return () => {
      cancelled = true;
      if (t) window.clearInterval(t);
    };
  }, [isLaunching]);

  /* -------------------- actions -------------------- */
  const handleLaunch = async () => {
    setIsLaunching(true);
    const launchPath = path || builds[0]?.path;
    if (!launchPath) {
      setError("Please first select a game folder or build in the library.");
      setTimeout(() => setError(null), 5000);
      setIsLaunching(false);
      return;
    }
    if (!user) {
      setError("No login details found.");
      setTimeout(() => setError(null), 5000);
      setIsLaunching(false);
      return;
    }

    try {
      await invoke("firstlaunch", {
        path: launchPath,
        email: user.email,
        password: user.password,
        eor: EOR,
      });
    } catch (err) {
      setError("Fehler beim Start: " + String(err));
      setTimeout(() => setError(null), 5000);
      setIsLaunching(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setPath(null);
    setBuilds([]);
    navigate("/login");
  };

  const handleToggleEOR = (next: boolean) => {
    setEOR(next);
    localStorage.setItem("EOR", String(next));
  };

  /* -------------------- builds -------------------- */
  const addBuild = async () => {
    const selected = await open({ directory: true });
    if (!selected || typeof selected !== "string") return;
    try {
      const hasEngine = await exists(await join(selected, "Engine"));
      if (!hasEngine) {
        setError("Invalid build: The folder must contain an 'Engine' folder.");
        setTimeout(() => setError(null), 5000);
        return;
      }
      if (builds.length >= 16) {
        setError("Maximum builds in library reached (16). Remove one first.");
        setTimeout(() => setError(null), 5000);
        return;
      }

      const splashPath = await join(selected, "FortniteGame", "Content", "Splash", "Splash.bmp");
      const hasSplash = await exists(splashPath);

      let coverDataUrl: string | undefined;
      if (hasSplash) {
        const bytes = await readBinaryFile(splashPath);
        const b64 = bytesToBase64(bytes);
        coverDataUrl = "data:image/bmp;base64," + b64;
      }

      const item: BuildItem = {
        id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
        path: selected,
        name: getFolderName(selected),
        coverDataUrl,
      };
      const updatedBuilds = [item, ...builds];
      setBuilds(updatedBuilds);
      setPath(selected);
      localStorage.setItem("ProjectMP.builds", JSON.stringify(updatedBuilds));
    } catch (e) {
      setError("Could not add build: " + String(e));
      setTimeout(() => setError(null), 5000);
    }
  };

  const removeBuild = (id: string) => {
    setBuilds((prev) => {
      const next = prev.filter((b) => b.id !== id);
      const removed = prev.find((b) => b.id === id);
      localStorage.setItem("ProjectMP.builds", JSON.stringify(next));
      if (removed && removed.path === path) {
        if (next[0]) setPath(next[0].path); else setPath(null);
      }
      return next;
    });
  };

  /* -------------------- UI pieces (Epic-like) -------------------- */

// left nav (compact Epic style)
const LeftNav: React.FC = () => (
  <div className="w-72 bg-[#0b1724]/70 border-r border-[#1e2a38] flex flex-col backdrop-blur-sm">
    <div className="px-4 py-3 flex items-center gap-3 border-b border-[#14202b]">
      {/* Custom logo image */}
      <div className="w-10 h-10 rounded-md overflow-hidden">
        <img
          src="https://i.ibb.co/1GVGmGPh/logo.png" // replace with your logo path or import
          alt="Logo"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1">
        <div className="text-sm text-white font-semibold">Project</div>
        <div className="text-xs text-slate-300">Launcher</div>
      </div>
      <div className="text-slate-400 text-xs"></div>
    </div>

    <nav className="p-3 space-y-1 flex-1">
      <NavItem icon={<Home size={18} />} label="Home" active={active === "home"} onClick={() => setActive("home")} />
      <NavItem icon={<Grid size={18} />} label="Library" active={active === "library"} onClick={() => setActive("library")} />
      <div className="mt-4 border-t border-[#14202b] pt-3">
        <NavItem icon={<Settings size={18} />} label="Settings" active={active === "settings"} onClick={() => setActive("settings")} />
      </div>
    </nav>

    <div className="p-3 border-t border-[#14202b]">
      <div className="bg-[#071018]/70 p-3 rounded-md flex items-center gap-3 backdrop-blur-sm">
        <div className="w-9 h-9 rounded-full bg-[#16303e] grid place-items-center text-sm text-white">
          {user?.email ? user.email[0].toUpperCase() : "–"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white truncate">{user?.email ?? "Not signed in"}</div>
          <div className="text-xs text-slate-400">EOR: {EOR ? "On" : "Off"}</div>
        </div>
        <button onClick={handleLogout} className="ml-2 px-2 py-1 rounded-md bg-[#2b4754] text-xs text-white hover:bg-[#334d5b]">
          <LogOut size={14} />
        </button>
      </div>
    </div>
  </div>
);

  function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void; }) {
    return (
      <button onClick={onClick} className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-3 ${active ? "bg-gradient-to-r from-[#0f1724] to-[#13222b] ring-1 ring-[#0ea5e9]/20 text-white" : "text-slate-300 hover:bg-[#071422]/60"}`}>
        <div className="w-7 h-7 grid place-items-center text-slate-200">{icon}</div>
        <div className="text-sm">{label}</div>
      </button>
    );
  }

/* Top bar (Epic-like) */
const TopBar: React.FC = () => (
  <div className="flex items-center justify-between px-6 py-3 bg-[#071422]/75 border-b border-[#0f1b26] backdrop-blur-sm">
    <div className="flex items-center gap-4">
      <div className="text-slate-200 text-sm font-medium">Project</div>
      {/* Search bar removed */}
    </div>

    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-full bg-[#0f2940] grid place-items-center text-slate-200"><User size={16} /></div>
      <div className="hidden sm:block text-slate-400 text-xs">{user?.email ?? "guest@local"}</div>
      <div className="flex gap-2">
      </div>
    </div>
  </div>
);

  /* Hero carousel / featured area (Epic-like big banner) */
  const HeroBanner: React.FC = () => {
    const current = builds.find((b) => b.path === path) ?? builds[0];
    const hero = current?.coverDataUrl ?? news[0]?.img ?? "https://images.unsplash.com/photo-1542751371-adc38448a04e?q=80&w=1400&auto=format&fit=crop&ixlib=rb-4.0.3&s=eea54b4e7a7f2a91a2b2a2b4d2f4a2b1";
    return (
      <div className="mb-6">
        <div className="relative rounded-xl overflow-hidden border border-[#122432] bg-[#000000]/10 backdrop-blur-sm">
          <img src={hero} alt="hero" className="w-full h-64 object-cover brightness-75" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#04121a]/80" />
          <div className="absolute left-8 bottom-8 right-8 flex items-center gap-6">
            <div className="w-40 h-24 bg-[#071a24]/60 rounded-md overflow-hidden border border-[#11303b]">
              <img src={hero} alt="thumb" className="w-full h-full object-cover" />
            </div>

            <div className="flex-1">
              <div className="text-2xl font-bold text-white drop-shadow">{current?.name ?? "Featured"}</div>
              <div className="text-sm text-slate-300 mt-1">{current ? `Installed: ${current.path}` : "No build selected — add one in Library"}</div>
              <div className="mt-4 flex items-center gap-3">
                <motion.button onClick={handleLaunch} whileTap={{ scale: 0.98 }} disabled={isLaunching || !current || !user} className="px-6 py-3 rounded-md bg-[#0ea5e9] text-black font-semibold shadow-lg disabled:opacity-60 flex items-center gap-2">
                  <Play size={16} /> {isLaunching ? "Launching..." : "PLAY"}
                </motion.button>

                <button onClick={() => setActive("library")} className="px-4 py-2 rounded-md bg-[#102834]/70 text-slate-200">Library</button>
                <button onClick={() => setActive("news")} className="px-4 py-2 rounded-md bg-[#102834]/70 text-slate-200">Patch Notes</button>
              </div>
            </div>

            <div className="w-56">
              <div className="bg-[#071824]/60 p-3 rounded-md border border-[#112a34]">
                <div className="text-xs text-slate-400">Status</div>
                <div className="text-sm text-white mt-1">{user?.email ? user.email.split("@")[0] : "Not logged in"}</div>
                <div className="text-xs text-slate-400 mt-1">EOR: {EOR ? "Enabled" : "Disabled"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-3 overflow-x-auto">
          {news.map((n) => (
            <motion.div key={n.id} whileHover={{ y: -6 }} className="min-w-[260px] rounded-md overflow-hidden border border-[#122432] bg-[#06161d]/70 backdrop-blur-sm">
              <img src={n.img} alt={n.title} className="h-28 w-full object-cover" />
              <div className="p-3">
                <div className="text-xs text-slate-400">{n.date}</div>
                <div className="text-sm text-white font-semibold mt-1">{n.title}</div>
                <div className="text-xs text-slate-300 mt-1 line-clamp-2">{n.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  };

  /* Library styled like Epic store grid */
  const LibraryPanel: React.FC = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xl font-semibold">Library</div>
          <div className="text-xs text-slate-400">Your builds & installs</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addBuild} className="px-3 py-2 rounded-md bg-[#0f3342]/80 text-slate-200 flex items-center gap-2"><Plus size={14} /> Add Build</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {builds.length === 0 ? (
          <div className="col-span-full p-6 bg-[#04121a]/60 rounded-md text-slate-400">No builds yet. Click 'Add Build' to import an installation folder containing an Engine folder.</div>
        ) : builds.map((b) => {
          const selected = b.path === path;
          return (
            <motion.div key={b.id} whileHover={{ scale: 1.02 }} className={`rounded-md overflow-hidden border ${selected ? "ring-2 ring-[#0ea5e9]/30" : "border-[#122432]"} bg-[#05131a]/60 backdrop-blur-sm`}>
              <div className="h-40 bg-[#071823]/60 flex items-center justify-center overflow-hidden">
                {b.coverDataUrl ? <img src={b.coverDataUrl} alt={b.name} className="w-full h-full object-cover" /> : <div className="text-xs text-slate-400">No cover</div>}
              </div>
              <div className="p-3">
                <div className="text-sm font-medium text-white truncate">{b.name}</div>
                <div className="text-xs text-slate-400 mt-1 truncate">{getFolderName(b.path)}</div>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => setPath(b.path)} className="px-3 py-1 rounded-md bg-[#0b2a36]/80 text-xs">Select</button>
                  <button onClick={() => { setPath(b.path); handleLaunch(); }} className="px-3 py-1 rounded-md bg-[#0ea5e9] text-xs text-black flex items-center gap-2"><Play size={12} /> Play</button>
                  <button onClick={() => removeBuild(b.id)} className="ml-auto px-2 py-1 rounded-md hover:bg-[#0b2a36] text-slate-300"><Trash2 size={14} /></button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  /* News / patch notes full list */
  const NewsPanel: React.FC = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><div className="text-xl font-semibold">News</div><div className="text-xs text-slate-400">Patch notes & announcements</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {news.map((n) => (
          <div key={n.id} className="rounded-md overflow-hidden border border-[#122432] bg-[#04121a]/60 backdrop-blur-sm">
            <div className="h-44 overflow-hidden"><img src={n.img} alt={n.title} className="w-full h-full object-cover" /></div>
            <div className="p-4">
              <div className="text-xs text-slate-400">{n.date}</div>
              <div className="text-lg text-white font-semibold mt-1">{n.title}</div>
              <div className="text-sm text-slate-300 mt-2">{n.desc}</div>
              <div className="mt-3"><button className="px-3 py-2 rounded-md bg-[#0b2a36] text-slate-200">Read more</button></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

const SettingsPanel: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {/* General settings */}
    <div className="p-4 rounded-md border border-[#122432] bg-[#04121a]/60 backdrop-blur-sm">
      <div className="text-sm font-semibold">General</div>
      <div className="text-xs text-slate-400 mt-2">Edit / Reset on release</div>
      <div className="mt-3 flex items-center gap-3">
        <label className="text-sm">EOR</label>
        <button
          onClick={() => handleToggleEOR(!EOR)}
          className={`ml-auto inline-flex h-7 w-14 items-center rounded-full p-1 ${EOR ? "bg-[#0ea5e9]" : "bg-[#0b2a36]"}`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${EOR ? "translate-x-7" : "translate-x-0"}`}
          ></span>
        </button>
      </div>
    </div>

    {/* Account / Logout */}
    <div className="p-4 rounded-md border border-[#122432] bg-[#04121a]/60 backdrop-blur-sm">
      <div className="text-sm font-semibold">Account</div>
      <div className="text-xs text-slate-400 mt-2">Signed in as</div>
      <div className="text-sm text-white mt-1">{user?.email ?? "–"}</div>
      <div className="mt-3">
        <button
          onClick={handleLogout}
          className="px-3 py-1 rounded-md bg-[#0ea5e9] text-black text-xs"
        >
          Logout
        </button>
      </div>
    </div>
  </div>
);

  /* -------------------- Render main layout -------------------- */
  return (
    <div
      className="w-screen h-screen flex text-slate-100 relative overflow-hidden"
      style={{
        backgroundImage: "url('https://i.ibb.co/hx42Ndqt/fn.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Blurred background overlay - visible but not overpowering */}
      <div className="absolute inset-0 backdrop-blur-2xl bg-black/50 z-0" />

      {/* Main content */}
      <div className="relative z-10 flex w-full h-full">
        <LeftNav />
        <div className="flex-1 flex flex-col">
          <TopBar />

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="absolute right-6 top-6 z-50">
                <div className="bg-red-600/90 text-white px-4 py-2 rounded-md shadow">{error}</div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-auto p-6">
            {active === "home" && (
              <>
                <HeroBanner />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="rounded-md border border-[#122432] p-4 bg-[#04121a]/60 backdrop-blur-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div><div className="text-lg font-semibold">Featured & Highlights</div><div className="text-xs text-slate-400">Top picks from your library</div></div>
                        <div className="flex items-center gap-2">
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {builds.slice(0, 4).length === 0 ? (
                          <div className="p-6 text-slate-400">Nothing featured — add builds to your library to feature them here.</div>
                        ) : builds.slice(0, 4).map(b => (
                          <div key={b.id} className="rounded-md overflow-hidden border border-[#122432] bg-[#06171f]/60 backdrop-blur-sm flex">
                            <div className="w-40 h-28 overflow-hidden">{b.coverDataUrl ? <img src={b.coverDataUrl} alt={b.name} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-slate-400">No cover</div>}</div>
                            <div className="p-3 flex-1">
                              <div className="font-semibold text-white">{b.name}</div>
                              <div className="text-xs text-slate-400 mt-1">{getFolderName(b.path)}</div>
                              <div className="mt-3 flex items-center gap-2">
                                <button onClick={() => { setPath(b.path); handleLaunch(); }} className="px-3 py-1 rounded-md bg-[#0ea5e9] text-black text-xs">Play</button>
                                <button onClick={() => removeBuild(b.id)} className="px-3 py-1 rounded-md bg-[#0b2a36] text-xs">Remove</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="rounded-md border border-[#122432] p-4 bg-[#04121a]/60 backdrop-blur-sm">
                      <div className="text-sm font-semibold">Quick Actions</div>
                      <div className="mt-3 space-y-2">
                        <button onClick={() => setActive("library")} className="w-full px-3 py-2 rounded-md bg-[#0b2a36]">Open Library</button>
                        <button onClick={() => setActive("news")} className="w-full px-3 py-2 rounded-md bg-[#0b2a36]">View Patch Notes</button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {active === "library" && <LibraryPanel />}
            {active === "news" && <NewsPanel />}
            {active === "settings" && <SettingsPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}