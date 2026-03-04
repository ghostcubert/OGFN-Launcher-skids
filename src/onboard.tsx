import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import { readBinaryFile, exists } from "@tauri-apps/api/fs";
import { join } from "@tauri-apps/api/path";
import { useNavigate } from "react-router-dom";
import { fetch, ResponseType } from "@tauri-apps/api/http";
import { Defaults } from "./defaults";
import { motion, AnimatePresence } from "framer-motion";
import { appWindow } from "@tauri-apps/api/window";
import { listen } from '@tauri-apps/api/event';
import {
  Home,
  Grid,
  Settings,
  LogOut,
  Play,
  Plus,
  Trash2,
  Trophy,
  ShoppingCart,
  Minus,
  X
} from "lucide-react";
import "./App.css";

interface UserData {
  email: string;
  password?: string;
  username?: string;
  discordId?: string;
  avatarHash?: string | null;
}

interface ArenaLeaderboardEntry {
  username: string;
  hype: number;
  division: number;
  discordId?: string;
  avatarHash?: string;
}

interface CosmeticInfo {
  id: string;
  name: string;
  description: string;
  image: string;
  rarity: string;
}

interface DownloadPayload {
  progress: number;
  speed: number;
  downloaded: number;
  total: number;
}

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

type TabKey = "home" | "library" | "news" | "shop" | "settings" | "leaderboard";
type BuildItem = { id: string; path: string; name: string; coverDataUrl?: string };
type NewsItem = { id: string; title: string; date: string; desc: string; img?: string };

export default function Onboard() {
  const navigate = useNavigate();
  const [launchStatus, setLaunchStatus] = useState("idle");
  const [active, setActive] = useState<TabKey>("home");
  const [path, setPath] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [user, setUser] = useState<{ email: string; password: string } | null>(null);
  const [builds, setBuilds] = useState<BuildItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [eor, setEor] = useState(false);
  const [ror, setRor] = useState(false);
  const [disablePreedits, setDisablePreedits] = useState(false);
  const [bubbleBuilds, setBubbleBuilds] = useState(false);
  const [mobileBuilds, setMobileBuilds] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStatus, setCurrentStatus] = useState("");
  const [warningMsg, setWarningMsg] = useState("");
  const [downloadData, setDownloadData] = useState<DownloadPayload | null>(null);
  const [statusText, setStatusText] = useState("");

useEffect(() => {
  const unlistenProgress = listen<DownloadPayload>('download-progress', (event) => {
    setDownloadData(event.payload);
  });

  const unlistenStatus = listen<string>('update-status', (event) => {
    setStatusText(event.payload);
  });

  return () => {
    unlistenProgress.then(f => f());
    unlistenStatus.then(f => f());
  };
}, []);

useEffect(() => {
  const unlisten = listen("launch-status-changed", (event) => {
    const newStatus = event.payload as string;
    setLaunchStatus(newStatus);

    if (newStatus === "closing") {
      setTimeout(() => {
        setLaunchStatus("idle");
      }, 3000);
    }
  });

  return () => { unlisten.then(f => f()); };
}, []);

useEffect(() => {
  const unlistenStart = listen('download-start', () => {
        setIsDownloading(true);
        setWarningMsg("");
    });
  const unlistenProgress = listen<number>('download-progress', (e) => setProgress(e.payload));
  const unlistenStatus = listen<string>('update-status', (e) => setCurrentStatus(e.payload));
  const unlistenWarn = listen<string>('download-warning', (e) => {
        setWarningMsg(e.payload);
    });
  const unlistenDone = listen('download-complete', () => {
        setIsDownloading(false);
        setWarningMsg("");
    });

  return () => {
    unlistenWarn.then(f => f());
    unlistenStart.then(f => f());
    unlistenProgress.then(f => f());
    unlistenStatus.then(f => f());
    unlistenDone.then(f => f());
  };
}, []);

const TabTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -5 }}
    transition={{ duration: 0.15, ease: "linear" }}
    className="w-full"
  >
    {children}
  </motion.div>
);

const LeaderboardPanel: React.FC = () => {
  const [entries, setEntries] = useState<ArenaLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
  if (!Defaults.ENABLE_LEADERBOARD_TAB || !Defaults.ENABLE_LEADERBOARD_API) {
    console.log("Leaderboard API is disabled via Defaults.");
    setEntries([]);
    setLoading(false);
    return;
  }

  try {
    const response = await fetch(`${Defaults.BACKEND_URL}/api/launcher/leaderboard`, {
      method: 'GET',
      responseType: ResponseType.JSON,
    });

    if (response.ok) {
      setEntries(response.data as ArenaLeaderboardEntry[]);
    }
  } catch (err) {
    console.error("Leaderboard Error:", err);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchLeaderboard();

    const interval = setInterval(fetchLeaderboard, 600000);
    
    return () => clearInterval(interval);
  }, []);

  const getRankStyle = (index: number) => {
    if (index === 0) return { icon: "🥇", color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400/20" };
    if (index === 1) return { icon: "🥈", color: "text-slate-300", bg: "bg-slate-300/10", border: "border-slate-300/20" };
    if (index === 2) return { icon: "🥉", color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" };
    return { icon: `#${index + 1}`, color: "text-slate-500", bg: "bg-transparent", border: "border-transparent" };
  };

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-6 px-1">
        <div>
          <div className="text-2xl font-black text-white uppercase tracking-tighter italic">Arena Leaderboard</div>
          <div className="text-[10px] text-slate-500 font-bold tracking-[0.2em] mt-0.5 uppercase opacity-80"></div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0b1724]/60 backdrop-blur-xl overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/40 text-slate-500 text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
              <th className="px-8 py-4 font-black">Rank</th>
              <th className="px-8 py-4 font-black">Player</th>
              <th className="px-8 py-4 font-black">Division</th>
              <th className="px-8 py-4 font-black text-right">Hype</th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-white/[0.03]">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-8 py-32 text-center">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4">
                  <div className="py-24 border-2 border-dashed border-white/20 rounded-2xl bg-white/[0.03] flex flex-col items-center justify-center transition-colors hover:border-white/30">
                    <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-4 text-slate-300 shadow-inner">
                      <Trophy size={28} />
                    </div>
                    <p className="text-slate-300 text-sm font-medium">
                      Leaderboard Unavailable
                    </p>
                    <p className="text-slate-500 text-xs mt-1">
                      Arena rankings are currently being calculated or offline.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              entries.map((player, index) => {
                const rank = getRankStyle(index);
                return (
                  <tr key={index} className="hover:bg-white/[0.01] transition-colors group">
                    <td className="px-8 py-5">
                      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-lg font-black text-xs ${rank.bg} ${rank.color} border ${rank.border}`}>
                        {rank.icon}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl border border-white/10 overflow-hidden bg-[#071422] flex items-center justify-center shadow-lg">
                          {player.discordId && player.avatarHash ? (
                            <img 
                              src={`https://cdn.discordapp.com/avatars/${player.discordId}/${player.avatarHash}.png?size=64`} 
                              alt={player.username}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <span className="text-xs font-black text-blue-400">{player.username[0]}</span>
                          )}
                        </div>
                        <span className="font-bold text-slate-200 group-hover:text-blue-400 transition-colors tracking-tight">
                          {player.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                         <span className="text-sm font-black text-slate-400 tracking-tighter italic">DIV</span>
                         <span className="text-lg font-black text-white italic tracking-tighter leading-none">{player.division}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="font-black text-blue-400 text-xl tracking-tighter tabular-nums drop-shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                        {player.hype.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ShopPanel: React.FC = () => {
  const [shopData, setShopData] = useState<{featured: any[], daily: any[]}>({ featured: [], daily: [] });
  const [cosmetics, setCosmetics] = useState<Record<string, CosmeticInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  const fetchShop = async () => {
    if (!Defaults.ENABLE_SHOP_TAB || !Defaults.ENABLE_SHOP_API) {
      console.log("Shop API is disabled.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${Defaults.BACKEND_URL}/api/launcher/shop`, {
        method: 'GET',
        responseType: ResponseType.JSON
      });

      if (!res.ok) throw new Error("Shop fetch failed");
      
      const data = res.data as any;
      setShopData(data);

      const allItems = [...data.featured, ...data.daily];
      const cosmeticMap: Record<string, CosmeticInfo> = {};
      await Promise.all(allItems.map(async (item) => {
        const rawId = item.itemGrants[0].split(":")[1];
        try {
          const apiRes = await fetch(`https://fortnite-api.com/v2/cosmetics/br/${rawId}`, {
              method: 'GET',
              responseType: ResponseType.JSON
          });
          
          const apiData = apiRes.data as any;
          if (apiRes.ok && apiData.status === 200) {
            cosmeticMap[rawId] = {
              id: apiData.data.id,
              name: apiData.data.name,
              description: apiData.data.description,
              image: apiData.data.images.icon || apiData.data.images.smallIcon,
              rarity: apiData.data.rarity.value,
            };
          }
        } catch (e) {
          console.warn("Failed to fetch info for", rawId);
        }
      }));

      setCosmetics(cosmeticMap);
    } catch (err) {
      console.error("Shop Error:", err);
    } finally {
      setLoading(false);
    }
  };

  fetchShop();
}, []);

  const getRarityStyle = (rarity: string) => {
    switch (rarity?.toLowerCase()) {
      case "legendary": return { border: "border-orange-500/40", text: "text-orange-400", bg: "from-orange-500/20" };
      case "epic": return { border: "border-purple-500/40", text: "text-purple-400", bg: "from-purple-500/20" };
      case "rare": return { border: "border-blue-500/40", text: "text-blue-400", bg: "from-blue-500/20" };
      case "uncommon": return { border: "border-green-500/40", text: "text-green-400", bg: "from-green-500/20" };
      default: return { border: "border-white/10", text: "text-slate-400", bg: "from-slate-500/10" };
    }
  };

  const RenderSection = (title: string, items: any[]) => (
  <div className="mb-12">
    <div className="flex items-center gap-6 mb-6 px-1">
      <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">{title}</h3>
      <div className="h-[1px] flex-1 bg-gradient-to-r from-white/10 to-transparent" />
    </div>
    
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
      {items.map((entry) => {
        const rawId = entry.itemGrants[0].split(":")[1];
        const info = cosmetics[rawId];
        const style = getRarityStyle(info?.rarity);

        return (
          <div 
            key={entry.id}
            className={`group relative rounded-xl overflow-hidden bg-[#0b1724] border transition-all duration-300 transform-gpu ${style.border}`}
          >
            <div className="aspect-square overflow-hidden relative bg-[#071422] group">
            <div className={`absolute inset-0 bg-gradient-to-t ${style.bg} to-transparent opacity-30 z-10 transition-opacity duration-500 group-hover:opacity-40`} />
            
            {info?.image ? (
              <img 
                src={info.image} 
                onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
                className="w-full h-full object-cover relative z-0 transition-transform duration-700 ease-out group-hover:scale-110 opacity-0" 
              />
            ) : (
              <div className="w-full h-full bg-[#071422]" />
            )}
            <div className="absolute top-3 right-3 z-30 px-2 py-1.5 rounded-md bg-black/60 backdrop-blur-xl flex items-center gap-2 border border-white/10 shadow-xl transition-transform duration-300 group-hover:scale-105">
              <img src="https://i.imgur.com/pfmvUEu.png" className="w-3.5 h-3.5" alt="V" />
              <span className="text-[11px] font-black text-white tracking-tighter uppercase italic">{entry.price}</span>
            </div>
          </div>
            <div className="p-3 bg-black/20">
              <div className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${style.text}`}>
                {info?.rarity || "Loading..."}
              </div>
              <div className="font-bold text-white text-[11px] truncate uppercase">
                {info?.name || "..."}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const isShopEmpty = shopData.featured.length === 0 && shopData.daily.length === 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40 w-full bg-transparent">
        <div className="w-8 h-8 border-2 border-white/5 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-transparent outline-none ring-0">
      {!isShopEmpty ? (
        <div className="px-1 pb-10">
          {shopData.featured.length > 0 && RenderSection("Featured", shopData.featured)}
          {shopData.daily.length > 0 && RenderSection("Daily", shopData.daily)}
        </div>
      ) : (
        <div className="w-full flex justify-center items-start pt-10">
          <div className="w-full max-w-2xl px-4">
            <div className="py-24 border-2 border-dashed border-white/20 rounded-2xl bg-white/[0.03] flex flex-col items-center justify-center transition-colors hover:border-white/30">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-4 text-slate-300 shadow-inner">
                <ShoppingCart size={28} />
              </div>
              <p className="text-slate-300 text-sm font-medium">
                Shop Unavailable
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Connection to the item store was lost. Please check back later.
              </p>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
  const [news] = useState<NewsItem[]>([
    { id: "n1", title: "Patch v2.5 — Performance & polish", date: "Oct 12, 2025", desc: "Performance improvements + UI polish. Read full patch notes in the launcher.", img: "https://i.ibb.co/HLQqKrj4/Chapter-2-Remix-Header.webp" },
    { id: "n2", title: "Matchmaking improvements", date: "Oct 9, 2025", desc: "We've fixed several issues and improved matchmaking stability.", img: "https://i.ibb.co/yBBpHp1D/Chapter-2-Season-4-Key-Art-Fortnite.webp" },
    { id: "n3", title: "Scheduled Maintenance", date: "Oct 7, 2025", desc: "Servers will be down for 3 hours for backend updates.", img: "https://i.ibb.co/DDsGMMyh/hq720.jpg" },
  ]);

  useEffect(() => {
    const savedPath = localStorage.getItem("buildPath");
    if (savedPath) setPath(savedPath);

    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {}
    }

    const savedBuilds = localStorage.getItem("SettingsMP.builds");
    if (savedBuilds) {
      try {
        const parsed = JSON.parse(savedBuilds) as BuildItem[];
        setBuilds(parsed);
        if (!savedPath && parsed.length > 0) setPath(parsed[0].path);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("SettingsMP.builds", JSON.stringify(builds));
  }, [builds]);

  useEffect(() => {
    if (path) localStorage.setItem("buildPath", path); else localStorage.removeItem("buildPath");
  }, [path]);

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
      eor: eor,
      disablePreedits: disablePreedits,
    });
  } catch (err) {
    setError("Startup error: " + String(err));
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

  const addBuild = async () => {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select Installation or Game Folder",
  });

  if (!selected || typeof selected !== "string") return;

  try {
    const hasEngine = await exists(await join(selected, "Engine"));

    if (hasEngine) {
      if (Defaults.ONLY_JOINABLE === true) {
        const folderName = getFolderName(selected);
        const allowedVersions = Defaults.JOINABLE_VERSION.split(',').map(v => v.trim());
        const isVersionAllowed = allowedVersions.some(version => folderName.includes(version));

        if (!isVersionAllowed) {
          const versionList = allowedVersions.join(' or ');
          setError(`Build not supported: Only version ${versionList} is allowed.`);
          setTimeout(() => setError(null), 5000);
          return;
        }
      }

      if (builds.length >= 5) {
        setError("Maximum builds in library reached.");
        setTimeout(() => setError(null), 5000);
        return;
      }

      const splashPath = await join(selected, "FortniteGame", "Content", "Splash", "Splash.bmp");
      const hasSplash = await exists(splashPath);

      let coverDataUrl: string | undefined;
      if (hasSplash) {
        const bytes = await readBinaryFile(splashPath);
        coverDataUrl = "data:image/bmp;base64," + bytesToBase64(bytes);
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
      localStorage.setItem("SettingsMP.builds", JSON.stringify(updatedBuilds));

    } else {
      setIsDownloading(true);
      setWarningMsg("");
      setStatusText("Initializing Download...");

      await invoke("install_build", { 
        url: "https://your-server.com/game-files.zip", 
        destPath: selected 
      });

      const gamePath = await join(selected, "MyGameName");
      
      const item: BuildItem = {
        id: String(Date.now()),
        path: gamePath,
        name: "Newly Installed Build",
      };

      const updatedBuilds = [item, ...builds];
      setBuilds(updatedBuilds);
      setPath(gamePath);
      localStorage.setItem("SettingsMP.builds", JSON.stringify(updatedBuilds));
      
      setIsDownloading(false);
      setStatusText("Installation Complete!");
    }
  } catch (e) {
    console.error(e);
    setError("Process failed: " + String(e));
    setIsDownloading(false);
    setTimeout(() => setError(null), 5000);
  }
};
  

  const removeBuild = (id: string) => {
    setBuilds((prev) => {
      const next = prev.filter((b) => b.id !== id);
      const removed = prev.find((b) => b.id === id);
      localStorage.setItem("SettingsMP.builds", JSON.stringify(next));
      if (removed && removed.path === path) {
        if (next[0]) setPath(next[0].path); else setPath(null);
      }
      return next;
    });
  };


const CustomTitleBar = () => (
  <div 
    data-tauri-drag-region 
    className="h-8 w-full bg-[#071422]/90 border-b border-white/10 flex justify-between items-center fixed top-0 left-0 z-[999] backdrop-blur-md select-none rounded-t-xl"
  >
    <div className="pl-4 flex items-center gap-2 pointer-events-none">
    </div>

    <div className="flex h-full">
      <button 
        onClick={() => appWindow.minimize()}
        className="px-4 h-full hover:bg-white/10 text-slate-400 transition-colors cursor-pointer"
      >
        <Minus size={14} />
      </button>
      <button 
        onClick={() => appWindow.close()}
        className="px-4 h-full hover:bg-red-600 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-tr-xl"
      >
        <X size={14} />
      </button>
    </div>
  </div>
);

interface LeftNavProps {
  active: TabKey;
  setActive: (val: TabKey) => void;
  user: UserData | null;
  handleLogout: () => void;
}

const LeftNav: React.FC<LeftNavProps> = ({ active, setActive, user, handleLogout }) => (
<div className="w-72 bg-[#0b1724]/95 border-r border-white/5 flex flex-col pt-8 backdrop-blur-md relative z-20">
  <div className="px-6 pb-8 flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-[#07080a] border border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(14,165,233,0.15)] overflow-hidden relative">
      <img 
        src={Defaults.LOGO_URL} 
        alt="Logo" 
        className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" 
      />
      <div className="absolute inset-0 border border-blue-500/10 rounded-xl pointer-events-none" />
    </div>
    
    <div>
      <div className="text-sm font-bold text-white tracking-wide">{Defaults.LAUNCHER_NAME}</div>
      <div className="text-[10px] text-blue-400 font-bold tracking-widest uppercase opacity-80">Launcher</div>
    </div>
  </div>
    <nav className="px-3 space-y-1 flex-1">
      <NavItem icon={<Home size={18} />} label="Home" id="home" active={active} setActive={setActive} />
      <NavItem icon={<Grid size={18} />} label="Library" id="library" active={active} setActive={setActive} />
      {Defaults.ENABLE_SHOP_TAB && (
      <NavItem icon={<ShoppingCart size={18} />} label="Shop" id="shop" active={active} setActive={setActive} />
      )}
      {Defaults.ENABLE_LEADERBOARD_TAB && (
      <NavItem icon={<Trophy size={18} />} label="Leaderboard" id="leaderboard" active={active} setActive={setActive} />
      )}
      
      
      <div className="my-4 mx-4 h-px bg-white/5" />
      
      <NavItem icon={<Settings size={18} />} label="Settings" id="settings" active={active} setActive={setActive} />
    </nav>
    <div className="p-4 mt-auto border-t border-white/5 bg-[#081018]/50">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full border border-blue-500/20 overflow-hidden bg-[#16303e]">
           <img 
             src={user?.discordId && user?.avatarHash 
               ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatarHash}.png?size=64`
               : `https://ui-avatars.com/api/?name=${user?.username || 'G'}&background=0ea5e9&color=fff`
             } 
             className="w-full h-full object-cover" 
           />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-white font-bold truncate">{user?.email ?? "Guest"}</div>
        </div>
      <button 
        onClick={handleLogout} 
        className="cursor-pointer p-2 text-slate-500 hover:text-red-500 transition-colors"
      >
        <LogOut size={16} />
      </button>
      </div>
    </div>
  </div>
);

const NavItem = ({ icon, label, id, active, setActive }: any) => {
  const isActive = active === id;
  return (
    <button
      onClick={() => setActive(id)}
      className={`cursor-pointer relative w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-300 group z-10 ${isActive ? "text-white" : "text-slate-400 hover:text-slate-200"}`}
    >
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-[#1e293b] rounded-lg border border-blue-500/30 shadow-[0_0_15px_rgba(14,165,233,0.1)] -z-10"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      <span className={isActive ? "text-blue-400" : "group-hover:text-white transition-colors"}>{icon}</span>
      <span className="text-sm font-medium tracking-wide">{label}</span>
    </button>
  );
};

interface TopBarProps {
  user: UserData | null;
}

const TopBar: React.FC<TopBarProps> = ({ user }) => {
  return (
    <div className="flex items-center justify-between px-6 py-3 bg-[#071422]/75 border-b border-[#0f1b26] backdrop-blur-sm">
      <div />
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-bold text-white uppercase tracking-wider">
            {user?.username ?? "Guest"}
          </div>
        </div>
        <div className="h-8 w-8 rounded-full border border-[#0ea5e9]/30 overflow-hidden bg-[#0f2940]">
          <img 
            src={user?.discordId && user?.avatarHash 
              ? `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatarHash}.png?size=64`
              : `https://ui-avatars.com/api/?name=${user?.username || 'G'}&background=0ea5e9&color=fff`
            } 
            className="w-full h-full object-cover" 
            alt="pfp"
          />
        </div>
      </div>
    </div>
  );
};

  const HeroBanner: React.FC = () => {
  const current = builds.find((b) => b.path === path) ?? builds[0];
  const bannerImage = current?.coverDataUrl || Defaults.PLACEHOLDER_IMAGE;

  return (
    <div className="mb-6 animate-in fade-in duration-700">
      <div className="relative rounded-2xl overflow-hidden border-2 border-white/10 bg-[#0b1724]/60 backdrop-blur-xl shadow-2xl transition-all">
        <div className="relative h-72">
          <img 
            key={bannerImage} 
            src={bannerImage} 
            className="w-full h-full object-cover brightness-[0.6] scale-100 animate-in fade-in duration-500" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1724] via-[#0b1724]/20 to-transparent" />
        </div>
        <div className="absolute inset-0 p-8 flex items-end gap-6">

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-1 w-6 bg-blue-500 rounded-full" />
              <span className="text-[10px] text-blue-400 font-black uppercase tracking-[0.2em]">
                {current ? "Active Build" : "Featured Content"}
              </span>
            </div>
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter drop-shadow-lg">
              {`${current?.name ?? "Ready to Play"} ${Defaults.LAUNCHER_NAME}`}
            </h2>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1 opacity-80">
              {current ? `PATH: ${current.path}` : "No build selected — add one in Library"}
            </p>

            <div className="mt-6 flex items-center gap-3">
              <motion.button 
                onClick={handleLaunch} 
                whileTap={{ scale: 0.97 }} 
                disabled={launchStatus !== "idle" || !current || !user} 
                className={`cursor-pointer px-8 py-3 rounded-xl text-white font-black uppercase italic tracking-tighter transition-all flex items-center gap-2 ${
                  launchStatus === "idle" 
                    ? "bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]" 
                    : "bg-slate-600 cursor-not-allowed opacity-70"
                }`}
              >
                <Play size={18} fill="currentColor" /> 
                {launchStatus === "idle" && "PLAY"}
                {launchStatus === "launching" && "Launching..."}
                {launchStatus === "ingame" && "In-Game"}
                {launchStatus === "closing" && "Closing..."}
              </motion.button>
              <button 
                onClick={() => setActive("library")} 
                className="cursor-pointer px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-black uppercase italic tracking-tighter hover:bg-white/10 transition-all"
              >
                Library
              </button>
            </div>
          </div>

          {true && (
            <div className="w-64 animate-in slide-in-from-right duration-500">
              <div className="bg-black/40 p-4 rounded-xl border border-white/10 backdrop-blur-md relative overflow-hidden">
                <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Username</div>
                <div className="text-sm text-white font-black uppercase italic tracking-tighter mt-1 truncate">
                  {user?.email ? user.email.split("@")[0] : "Not logged in"}
                </div>

                <div className="mt-4">
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-[8px] text-slate-500 font-black uppercase tracking-widest">
                      {isDownloading ? "Download Progress" : "System Status"}
                    </span>
                    {isDownloading && (
                      <span className="text-[9px] text-blue-400 font-bold italic">
                        {downloadData?.progress.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                      initial={{ width: 0 }}
                      animate={{ 
                        width: isDownloading ? `${downloadData?.progress || 0}%` : "100%" 
                      }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>

                {isDownloading && downloadData && (
                  <div className="mt-3 flex flex-col gap-1">
                    <div className="flex justify-between text-[9px] font-mono text-slate-400">
                      <span>Speed:</span>
                      <span className="text-white">{(downloadData.speed / 1024 / 1024).toFixed(2)} MB/s</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-slate-400">
                      <span>Size:</span>
                      <span>{(downloadData.downloaded / 1024 / 1024).toFixed(0)} / {(downloadData.total / 1024 / 1024).toFixed(0)} MB</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    <div className="mt-4 flex gap-4 overflow-x-auto pb-4 no-scrollbar">
      {news.map((n) => (
        <motion.div 
          key={n.id} 
          whileHover={{ y: -5 }} 
          className="min-w-[280px] rounded-xl overflow-hidden border border-white/5 bg-[#0b1724]/40 backdrop-blur-sm group cursor-pointer relative"
        >
          <div className="relative h-28 overflow-hidden transition-transform duration-500 ease-out group-hover:scale-110">
            <img src={n.img} alt={n.title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1724] to-transparent opacity-90" />
          </div>
          <div className="p-4 relative z-10">
            <div className="text-[9px] text-blue-400 font-black uppercase tracking-widest">{n.date}</div>
            <div className="text-sm text-white font-black uppercase italic tracking-tight mt-1 group-hover:text-blue-400 transition-colors duration-300">
              {n.title}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-snug">{n.desc}</div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 origin-center scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100 z-20" />
        </motion.div>
      ))}
    </div>
  </div>
);
};

const LibraryPanel: React.FC = () => (
  <div className="animate-in fade-in duration-500">
    <div className="flex items-center justify-between mb-6 px-1">
      <div>
        <div className="text-2xl font-black text-white uppercase tracking-tighter italic">Library</div>
        <div className="text-[10px] text-slate-400 font-bold tracking-[0.15em] mt-1 uppercase opacity-70">Build Management</div>
      </div>
      
      <button 
        onClick={addBuild} 
        className="cursor-pointer px-5 py-2 rounded-lg bg-[#0b2a36] hover:bg-[#123a4a] text-slate-200 text-xs font-bold border border-white/10 hover:border-blue-500/40 transition-all duration-300 flex items-center gap-2 active:scale-95 shadow-lg"
      >
        <Plus size={14} strokeWidth={3} /> ADD BUILD
      </button>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
      {builds.length === 0 ? (
        <div className="col-span-full py-24 border-2 border-dashed border-white/20 rounded-2xl bg-white/[0.03] flex flex-col items-center justify-center transition-colors hover:border-white/30">
          <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-4 text-slate-300 shadow-inner">
            <Grid size={28} />
          </div>
          <p className="text-slate-300 text-sm font-medium">No builds found in your directory</p>
          <p className="text-slate-500 text-xs mt-1">Click 'Add Build' to start your collection</p>
        </div>
      ) : (
        builds.map((b) => {
          const selected = b.path === path;
          return (
            <div 
              key={b.id} 
              className={`group relative rounded-xl overflow-hidden bg-[#0b1724]/60 border backdrop-blur-md transition-all duration-500 ease-out transform-gpu hover:-translate-y-1.5 ${
                selected ? "border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.15)]" : "border-white/10 shadow-xl shadow-black/40"
              }`}
            >
              <div className="h-44 bg-[#071823] relative overflow-hidden">
                {b.coverDataUrl ? (
                  <img 
                    src={b.coverDataUrl} 
                    alt={b.name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-slate-700 uppercase tracking-tighter">No Cover</div>
                )}
                <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
              <div className="p-4 bg-gradient-to-b from-transparent to-black/30">
                <div className="text-sm font-bold text-white truncate group-hover:text-blue-400 transition-colors duration-300">
                  {b.name}
                </div>
                <div className="text-[10px] text-slate-500 font-bold mt-1 truncate uppercase tracking-widest opacity-80">
                  {getFolderName(b.path)}
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                  <div className={`flex items-center gap-2`}>
                  </div>
                  
                  <button 
                    onClick={() => removeBuild(b.id)} 
                    className="cursor-pointer p-1.5 rounded-lg text-slate-600 hover:text-red-500 hover:bg-red-500/10 transition-all duration-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  </div>
);

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
            </div>
          </div>
        ))}
      </div>
    </div>
  );

const SettingsPanel: React.FC<{
  eor: boolean; setEor: (v: boolean) => void;
  ror: boolean; setRor: (v: boolean) => void;
  disablePreedits: boolean;
  setDisablePreedits: (v: boolean) => void;
  bubbleBuilds: boolean; setBubbleBuilds: (v: boolean) => void;
  mobileBuilds: boolean; setMobileBuilds: (v: boolean) => void;
}> = ({ eor, setEor, ror, setRor, bubbleBuilds, setBubbleBuilds, mobileBuilds, setMobileBuilds }) => {

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">

      <div className="flex items-center justify-between mb-8 px-1">
        <div>
          <div className="text-2xl font-black text-white uppercase tracking-tighter italic">Preferences</div>
          <div className="text-[10px] text-blue-400 font-bold tracking-[0.2em] mt-0.5 uppercase opacity-90">Game Settings</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">

        <div className="p-10 rounded-2xl border-2 border-white/10 bg-[#0b1724]/60 backdrop-blur-xl shadow-2xl transition-all hover:bg-[#0b1724]/80 flex flex-col justify-between">
          <div className="flex items-center justify-between group">
            <div>
              <p className="text-sm font-black text-slate-200 group-hover:text-white transition-colors uppercase italic tracking-tighter">Edit on Release</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Instant Edit</p>
            </div>
            <button
              type="button"
              onClick={() => setEor(!eor)} 
              className={`cursor-pointer relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ${eor ? "bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]" : "bg-white/10"}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${eor ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="h-px bg-white/5" />
          <div className="flex items-center justify-between group">
            <div>
              <p className="text-sm font-black text-slate-200 group-hover:text-white transition-colors uppercase italic tracking-tighter">Reset on Release</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 text-amber-500/80">IN DEVELOPMENT: Instant Reset</p>
            </div>
            <button
              type="button"
              onClick={() => setRor(!ror)} 
              className={`cursor-pointer relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ${ror ? "bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]" : "bg-white/10"}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${ror ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          <div className="h-px bg-white/5" />
          <div className="flex items-center justify-between group">
            <div>
              <p className="text-sm font-black text-slate-200 group-hover:text-white transition-colors uppercase italic tracking-tighter">Disable Pre-edits</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Removes Pre-edit delay</p>
            </div>
            <button
              type="button"
              onClick={() => setDisablePreedits(!disablePreedits)} 
              className={`cursor-pointer relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ${disablePreedits ? "bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]" : "bg-white/10"}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${disablePreedits ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          <div className="pt-6" /> 
        </div>
        <div className="flex flex-col gap-6">
          <div className="p-8 rounded-2xl border-2 border-white/10 bg-[#0b1724]/60 backdrop-blur-xl shadow-2xl transition-all hover:bg-[#0b1724]/80">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.1)]">
                <Grid size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight italic">Performance</h4>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Visual</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="flex items-center justify-between group">
                <div>
                  <p className="text-sm font-black text-slate-200 group-hover:text-white transition-colors uppercase italic tracking-tighter">Bubble Builds</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">IN DEVELOPMENT Bubble Style</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBubbleBuilds(!bubbleBuilds)}
                  className={`cursor-pointer relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ${bubbleBuilds ? "bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]" : "bg-white/10"}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${bubbleBuilds ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              <div className="h-px bg-white/5" />

              <div className="flex items-center justify-between group">
                <div>
                  <p className="text-sm font-black text-slate-200 group-hover:text-white transition-colors uppercase italic tracking-tighter">Mobile Builds</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">IN DEVELOPMENT Low Meshes</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileBuilds(!mobileBuilds)}
                  className={`cursor-pointer relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 ${mobileBuilds ? "bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]" : "bg-white/10"}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 ${mobileBuilds ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-5 rounded-2xl border-2 border-white/10 bg-[#0b1724]/60 backdrop-blur-xl shadow-2xl flex items-center justify-between transition-all hover:bg-[#0b1724]/80 group">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                <Play size={18} fill="currentColor" className="ml-0.5" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Launcher Build</p>
                <p className="text-sm text-white font-black uppercase italic tracking-tighter">{Defaults.LAUNCHER_VERSION}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
  return (
  <div
    className="w-screen h-screen flex text-slate-100 relative overflow-hidden rounded-xl border border-[#1e2a38]"
    style={{
      backgroundImage: `url('${Defaults.MAIN_BACKGROUND_URL}')`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }}
  >
    <div className="absolute inset-0 backdrop-blur-2xl bg-black/50 z-0" />

    <CustomTitleBar />
    <div className="relative z-10 flex w-full h-full pt-8">
      <LeftNav 
        active={active} 
        setActive={setActive} 
        user={user} 
        handleLogout={handleLogout} 
      />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar user={user} />
        
          <AnimatePresence mode="wait">
            {error && (
              <div className="fixed inset-0 z-[70] overflow-hidden flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm pointer-events-auto cursor-default"
                />

                <motion.div
                  key={error}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                  className="relative z-[80] pointer-events-auto"
                >
                  <div className="w-[340px] bg-[#111827] border border-blue-500/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    
                    <div className="p-8">
                      <div className="flex items-start gap-4 text-left">
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5 text-blue-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <path d="M12 9v4" /><path d="M12 17h.01" />
                          </svg>
                        </div>

                        <div className="flex flex-col">
                          <h3 className="text-slate-100 font-semibold text-base mb-1 leading-none">
                            Error
                          </h3>
                          <p className="text-slate-400 text-[13px] mt-2 leading-relaxed pr-2">
                            {error}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="w-full h-[3px] bg-slate-800">
                      <motion.div 
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ 
                          duration: 3, 
                          ease: "linear"
                        }}
                        onAnimationComplete={() => {
                          setError(null);
                        }}
                        className="h-full bg-blue-500/60"
                      />
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
  <AnimatePresence mode="wait">
    {active === "home" && (
      <TabTransition key="home">
        <HeroBanner />
        <div className="flex flex-col lg:flex-row items-stretch gap-6 mt-4">
          <div className="flex-[3] flex flex-col">
            <div className="flex-1 p-6 rounded-2xl border-2 border-white/10 bg-[#0b1724]/60 backdrop-blur-xl shadow-2xl flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Featured & Highlights</h3>
                  <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em] mt-0.5">Your Optimized Collection</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1">
                {builds.length === 0 ? (
                  <div className="h-24 col-span-full flex items-center justify-center rounded-xl border-2 border-dashed border-white/5 opacity-40">
                    <p className="text-xs font-black uppercase italic tracking-widest">Storage Empty</p>
                  </div>
                ) : (
                  builds.slice(0, 4).map(b => (
                    <motion.div 
                      key={b.id} 
                      whileHover={{ 
                        y: -4, 
                        transition: { duration: 0.3, ease: "easeOut" } 
                      }}
                      className="group relative rounded-xl overflow-hidden border border-white/10 bg-[#071422]/40 flex h-24 transition-all duration-300 ease-out hover:border-[#0ea5e9]/30 hover:bg-[#0ea5e9]/10"
                    >
                      <div className="w-24 h-full overflow-hidden bg-black/40 border-r border-white/5 shrink-0 relative">
                        {b.coverDataUrl ? (
                          <img 
                            src={b.coverDataUrl} 
                            alt={b.name} 
                            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" 
                          />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-slate-700">
                            <Grid size={16} />
                          </div>
                        )}
                      </div>
                      <div className="p-3 flex-1 min-w-0 flex items-center justify-between relative z-10">
                        <div className="min-w-0 pr-2">
                          <div className="font-black text-white uppercase italic tracking-tighter truncate text-sm group-hover:text-[#0ea5e9] transition-colors duration-300">
                            {b.name}
                          </div>
                          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 truncate group-hover:text-slate-300 transition-colors duration-300">
                            {getFolderName(b.path)}
                          </div>
                        </div>
                        <button 
                          onClick={() => removeBuild(b.id)} 
                          className="cursor-pointer p-2.5 rounded-lg bg-white/5 text-slate-500 hover:text-red-500 hover:bg-red-500/20 transition-all duration-300 shrink-0 border border-transparent hover:border-red-500/20"
                          title="Remove Build"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#0ea5e9] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabTransition>
          )}
            {active === "library" && (
              <TabTransition key="library">
                <LibraryPanel />
              </TabTransition>
            )}

            {active === "news" && (
              <TabTransition key="news">
                <NewsPanel />
              </TabTransition>
            )}

            {active === "shop" && Defaults.ENABLE_SHOP_TAB && (
              <TabTransition key="shop">
                <ShopPanel />
              </TabTransition>
            )}

            {active === "settings" && (
              <TabTransition key="settings">
                <SettingsPanel 
                  eor={eor} setEor={setEor}
                  ror={ror} setRor={setRor}
                  disablePreedits={disablePreedits} setDisablePreedits={setDisablePreedits}
                  bubbleBuilds={bubbleBuilds} setBubbleBuilds={setBubbleBuilds}
                  mobileBuilds={mobileBuilds} setMobileBuilds={setMobileBuilds}
                />
              </TabTransition>
            )}

            {active === "leaderboard" && Defaults.ENABLE_LEADERBOARD_TAB && (
              <TabTransition key="leaderboard">
                <LeaderboardPanel />
              </TabTransition>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isDownloading && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-md"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
                  className={`w-[400px] p-8 rounded-3xl bg-[#0b1724] border shadow-2xl text-center transition-colors duration-300 ${warningMsg ? "border-red-500 shadow-red-500/20" : "border-white/10"}`}
                >
                  {warningMsg ? (
                      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
                          <X className="w-8 h-8 text-red-500" />
                      </div>
                  ) : (
                      <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-6" />
                  )}

                  <h2 className="text-xl font-black uppercase italic tracking-tighter text-white mb-2">
                      {warningMsg ? "Download Error" : "Syncing Build"}
                  </h2>
                  
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-6 ${warningMsg ? "text-red-400" : "text-slate-400"}`}>
                      {warningMsg || currentStatus || "Verifying Files..."}
                  </p>
                  
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-2">
                    <motion.div 
                      className={`h-full shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-colors duration-300 ${warningMsg ? "bg-red-500" : "bg-blue-500"}`}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold">{progress}%</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  </div>
);
}