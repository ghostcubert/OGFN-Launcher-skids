import { useState, useEffect } from "react";
import { open } from "@tauri-apps/api/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import "./App.css";

const IconFolder = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#e3e3e3"><path d="M168-192q-29 0-50.5-21.5T96-264v-432q0-29.7 21.5-50.85Q139-768 168-768h216l96 96h312q29.7 0 50.85 21.15Q864-629.7 864-600v336q0 29-21.15 50.5T792-192H168Zm0-72h624v-336H450l-96-96H168v432Zm0 0v-432 432Z"/></svg>
);
const IconHome = () => (
 <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#e3e3e3"><path d="M264-216h96v-240h240v240h96v-348L480-726 264-564v348Zm-72 72v-456l288-216 288 216v456H528v-240h-96v240H192Zm288-327Z"/></svg>
);


const SettingsIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#e3e3e3" {...props}><path d="m403-96-22-114q-23-9-44.5-21T296-259l-110 37-77-133 87-76q-2-12-3-24t-1-25q0-13 1-25t3-24l-87-76 77-133 110 37q19-16 40.5-28t44.5-21l22-114h154l22 114q23 9 44.5 21t40.5 28l110-37 77 133-87 76q2 12 3 24t1 25q0 13-1 25t-3 24l87 76-77 133-110-37q-19 16-40.5 28T579-210L557-96H403Zm59-72h36l19-99q38-7 71-26t57-48l96 32 18-30-76-67q6-17 9.5-35.5T696-480q0-20-3.5-38.5T683-554l76-67-18-30-96 32q-24-29-57-48t-71-26l-19-99h-36l-19 99q-38 7-71 26t-57 48l-96-32-18 30 76 67q-6 17-9.5 35.5T264-480q0 20 3.5 38.5T277-406l-76 67 18 30 96-32q24 29 57 48t71 26l19 99Zm18-168q60 0 102-42t42-102q0-60-42-102t-102-42q-60 0-102 42t-42 102q0 60 42 102t102 42Zm0-144Z"/></svg>
);

// --- Helper components ---
function NavItem({ icon: Icon, label, active, collapsed, onClick }: {
  icon: any;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition cursor-pointer ${
        active
          ? "bg-yellow-600/20 text-yellow-300 ring-1 ring-inset ring-yellow-500/30"
          : "text-gray-300 hover:text-white hover:bg-white/5"
      }`}
      aria-label={label}
    >
      <Icon className="shrink-0" />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            className="truncate"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {collapsed && (
        <span className="pointer-events-none absolute left-full ml-3 -translate-y-1/2 top-1/2 whitespace-nowrap rounded-md bg-gray-900/90 px-2 py-1 text-xs text-gray-100 opacity-0 shadow-lg ring-1 ring-gray-700/50 transition group-hover:opacity-100">
          {label}
        </span>
      )}
    </button>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="bg-gray-800/40 rounded-2xl border border-gray-700/40 p-5">
      <h3 className="text-sm font-semibold tracking-wide text-gray-200 mb-3">{title}</h3>
      {children}
    </div>
  );
}

// Kleiner Toggle-Switch (ohne externe Libs)
function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  id?: string;
}) {
  const toggleId = id ?? "toggle-" + label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="flex items-center justify-between">
      <label htmlFor={toggleId} className="cursor-pointer space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-gray-400">{description}</p>}
      </label>
      <button
        id={toggleId}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition
          ${checked ? "bg-yellow-600" : "bg-gray-600"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition
            ${checked ? "translate-x-5" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}

// --- Main component ---
function Settings() {
  const navigate = useNavigate();
  const [, setPath] = useState<string | null>(null);
  const [user, setUser] = useState<{ email: string; password: string } | null>(null);
  const [collapsed] = useState(false);

  // --- persistent Switch: Auto Launch ---
  const [EOR, setEOR] = useState<boolean>(false);

  useEffect(() => {
    const savedPath = localStorage.getItem("buildPath");
    if (savedPath) setPath(savedPath);

    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        console.error("Error parsing localStorage user");
      }
    }

    const raw = localStorage.getItem("autoLaunchEnabled");
    if (raw !== null) {
      setEOR(raw === "true");
    }
  }, []);

  const handleFolderSelect = async () => {
    const selected = await open({ directory: true });
    if (selected && typeof selected === "string") {
      setPath(selected);
      localStorage.setItem("buildPath", selected);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setPath(null);
    navigate("/login");
  };

  const home = () => {
    navigate("/onboard");
  };

  // Switch persistieren sobald geändert
  const handleToggleEOR = (next: boolean) => {
    setEOR(next);
    localStorage.setItem("EOR", String(next));
  };

  return (
    <div className="root w-screen rounded-xl h-screen bg-black text-gray-100">
      {/* App frame */}
      <div className="h-full w-full flex">
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: collapsed ? 76 : 256 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="relative h-full bg-black/60 backdrop-blur-xl border-r border-white/10 shadow-2xl rounded-tl-xl rounded-bl-xl"
        >
          {/* Brand / Toggle */}
          <div data-tauri-drag-region className="flex items-center justify-center gap-2 px-4 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-lg font-bold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-yellow-300 to-yellow-500"
                >
                  ProjectMP
                </motion.span>
              )}
            </div>
          </div>

          {/* Nav */}
          <div className="p-3 space-y-2">
            <NavItem icon={IconHome} label="Home" onClick={home} collapsed={collapsed}/>
            <NavItem icon={IconFolder} label="Select folder" collapsed={collapsed} onClick={handleFolderSelect} />
            <br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br /><br />
            <NavItem icon={SettingsIcon} label="Settings" collapsed={collapsed}/>
          </div>

          {/* User badge */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-3 rounded-bl-xl">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5">
              {!collapsed && (
                <>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Signed in</p>
                    <p className="truncate text-sm font-medium">
                      {user?.email ? user.email.split("@")[0] : "–"}
                    </p>
                  </div>
                  <motion.a
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.99 }}
                    href="https://discord.com/channels/1360211736216469696/1413844727035596880"
                    target="_blank"
                    rel="noreferrer"
                    className="cursor-pointer ml-[1.3rem] px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-br from-purple-600 to-yellow-700 hover:bg-gradient-to-br hover:from-yellow-600 hover:to-purple-700 hover:text-white transition"
                  >
                    Donate
                  </motion.a>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={handleLogout}
                    className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-br from-red-500 to-yellow-800/50 hover:bg-gradient-to-br hover:from-yellow-600 hover:to-red-700 hover:text-red transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z"/></svg>
                  </motion.button>
                </>
              )}
            </div>
          </div>
        </motion.aside>

        {/* Content column */}
        <div className="flex-1 h-full flex flex-col overflow-hidden">
          {/* Topbar */}

          {/* Main */}
          <div className="flex-1 overflow-auto p-6 bg-gradient-to-b from-black/40 to-transparent root overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              {/* Settings / Switch */}
              <Section title="Settings">
                <div className="space-y-3">
                  <Toggle
                    checked={EOR}
                    onChange={handleToggleEOR}
                    label="Edit/Reset on release"
                    description=""
                  />
                </div>
              </Section>

              {/* Account */}
              <Section title="Account">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Signed in</span>
                    <span className="text-sm text-gray-100">
                      {user?.email ?? "–"}
                    </span>
                  </div> <br />
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleLogout}
                    className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-red-500/40 transition cursor-pointer"
                  >
                    Logout
                  </motion.button>
                </div>
              </Section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
