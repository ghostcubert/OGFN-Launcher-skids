import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fetch, ResponseType } from "@tauri-apps/api/http";
import { Defaults } from "./defaults";
import { Minus, X } from "lucide-react";
import { appWindow } from "@tauri-apps/api/window";

const IconEye = (props: any) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...props}>
    <path fill="currentColor" d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
  </svg>
);

const IconEyeOff = (props: any) => (
  <svg viewBox="0 0 24 24" width="20" height="20" {...props}>
    <path
      fill="currentColor"
      d="M2 5.27 3.28 4 20 20.72 18.73 22l-3.2-3.2A11.58 11.58 0 0 1 12 19C5 19 2 12 2 12a18.85 18.85 0 0 1 4.1-5.57L2 5.27Zm8.83 3.54a4 4 0 0 1 4.36 4.36l-4.36-4.36ZM12 7c7 0 10 7 10 7a18.92 18.92 0 0 1-4.54 5.72l-1.42-1.42A11.83 11.83 0 0 0 20 12s-3-7-8-7a11.83 11.83 0 0 0-4.3.8l-1.5-1.5A13.68 13.68 0 0 1 12 7Z"
    />
  </svg>
);

interface Credentials {
  email: string;
  password: string;
}

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

export default function Login() {
  const [avatarHash, setAvatarHash] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [username, setUsername] = useState("");
  const navigate = useNavigate();
  const [form, setForm] = useState<Credentials>({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [remember] = useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError(null);
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailOk = /\S+@\S+\.\S+/.test(form.email);
    if (!emailOk) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    const isApiEnabled = Defaults.ENABLE_LOGIN_API;

    if (!isApiEnabled) {
      const guestUser = {
        email: form.email,
        password: form.password,
        username: "Guest Player",
        discordId: "",
        avatarHash: null
      };
      
      if (remember) {
        localStorage.setItem("user", JSON.stringify(guestUser));
      }
      
      setIsSuccess(true);
      setTimeout(() => navigate("/onboard"), 1000);
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        email: form.email,
        password: form.password,
      });

      const response = await fetch(`${Defaults.BACKEND_URL}/api/launcher/login?${params.toString()}`, {
        method: "GET",
        responseType: ResponseType.Text,
      });

      if (response.ok) {
        const data = JSON.parse(response.data as string);
        const sessionUser = {
            email: form.email,
            password: form.password,
            username: data.username,
            discordId: data.discordId,
            avatarHash: data.avatarHash
        };
        
        setUsername(data.username);
        setDiscordId(data.discordId);
        setAvatarHash(data.avatarHash);

        if (remember) {
          localStorage.setItem("user", JSON.stringify(sessionUser));
        }
        setIsSuccess(true);
        setTimeout(() => navigate("/onboard"), 2000);
      } else {
        const serverMessage = response.data as string;
        setError(response.status === 400 && serverMessage === "Error!" ? "Wrong Credentials" : (serverMessage || "An error occurred."));
      }
    } catch (err) {
      console.error(err);
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
};

  return (
      <div className="w-screen h-screen relative overflow-hidden text-gray-100 bg-[#0b0c10] select-none rounded-xl border border-white/10 font-sans">
      <CustomTitleBar />
      <div className="absolute inset-0 rounded-xl overflow-hidden z-0">
        <img
          src={Defaults.LOGIN_BACKGROUND_URL}
          alt="background"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none" />
      </div>
      <div className="relative flex flex-col items-center justify-center h-full w-full px-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/20 blur-[100px] rounded-full pointer-events-none" />
    <AnimatePresence mode="wait">
        {!isSuccess ? (
        <motion.div
          key="login-form"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative w-full max-w-[400px] bg-black/60 backdrop-blur-2xl border border-white/10 p-10 rounded-2xl shadow-2xl z-10"
        >
          <div className="text-center mb-8">
            <img
              src={Defaults.LOGO_URL}
              alt="Logo"
              className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[#07080a] border border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(14,165,233,0.15)] overflow-hidden relative" 
            />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Sign In
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              To Play {Defaults.LAUNCHER_NAME}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate autoComplete="off">
            <div>
              <label className="text-sm text-gray-300">Email</label>
              <input
                type="email"
                name="email"
                autoComplete="one-time-code" 
                spellCheck="false"
                value={form.email}
                onChange={handleChange}
                placeholder="name@example.com"
                className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-lg px-4 py-3 outline-none focus:border-blue-500/50 focus:bg-blue-500/5 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="text-sm text-gray-300">Password</label>
              <div className="relative mt-1">
                <input
                  type={showPw ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-lg px-4 py-3 outline-none focus:border-blue-500/50 focus:bg-blue-500/5 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="cursor-pointer absolute inset-y-0 right-2 flex items-center px-2 rounded-lg hover:bg-white/5 transition"
                >
                  {showPw ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                animate={{ 
                  opacity: 1, 
                  height: "auto", 
                  marginTop: 0, 
                  marginBottom: 16
                }}
                exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <p className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-xs text-center font-medium">
                  {error}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="cursor-pointer w-full rounded-lg px-6 py-3 font-bold text-sm uppercase tracking-wide text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
            >
            {loading ? "Logging in..." : "Sign In"}
            </motion.button>
          </form>
            <div className="mt-8 text-center">
              <span className="text-slate-500 text-xs">Don't have an account? </span>
              <button 
                type="button" 
                onClick={() => window.open(import.meta.env.VITE_DISCORD_LINK, "_blank")} 
                className="text-[#0ea5e9] text-xs font-bold hover:underline cursor-pointer"
              >
                Create one
              </button>
            </div>
        </motion.div>
        ) : (
          <motion.div
  key="welcome-msg"
  initial={{ opacity: 0, scale: 0.9 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.5 }}
  className="text-center z-50"
>
  <motion.div 
  initial={{ scale: 0, rotate: -10 }} 
  animate={{ scale: 1, rotate: 0 }} 
  transition={{ type: "spring", delay: 0.2 }}
  className="w-24 h-24 mx-auto mb-6 relative"
>
  <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-xl animate-pulse" />
  
  <div className="relative w-full h-full rounded-full border-2 border-blue-500 overflow-hidden bg-[#0b0c10] shadow-[0_0_40px_rgba(37,99,235,0.4)]">
  {discordId ? (
    <img 
      key={discordId}
  src={
    avatarHash 
      ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=256`
      : `https://ui-avatars.com/api/?name=${username}&background=0ea5e9&color=fff`
  } 
  alt="Profile"
  className="w-full h-full object-cover"
  onError={(e) => {
    e.currentTarget.src = `https://ui-avatars.com/api/?name=${username}&background=0ea5e9&color=fff`;
  }}
    />
  ) : null}

  <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white -z-10">
     {username.charAt(0).toUpperCase()}
  </div>
</div>
</motion.div>

  <h2 className="text-4xl font-bold text-white tracking-tight">
    Welcome, <span className="text-blue-400">{username}</span>
  </h2>
  <p className="text-slate-400 mt-3 text-lg">Launching...</p>
</motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}