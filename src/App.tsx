import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import axiosRetry from "axios-retry";
import loading from "./assets/pulse.svg";
import { motion } from "framer-motion";

axiosRetry(axios, { retries: 3 });

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      navigate("/onboard");
      return;
    }
    if (!raw) {
      navigate("/login");
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const hasEmail = parsed && typeof parsed.email === "string" && parsed.email.length > 0;
      const hasPassword = parsed && typeof parsed.password === "string" && parsed.password.length > 0;
      if (!hasEmail || !hasPassword) {
        navigate("/login");
        return;
      }
    } catch {
      localStorage.removeItem("user");
      navigate("/login");
      return;
    }
  }, [navigate]);

  const [isHovering] = useState(false);
  const [cursorPos] = useState({ x: 0, y: 0 });

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden border border-gray-800 shadow-2xl w-full max-w-md mx-auto h-auto backdrop-blur-sm bg-opacity-80">
      {/* Dynamic RGB Border Effect */}
      <motion.div
        className="absolute inset-0 rounded-2xl p-[1.5px] pointer-events-none"
        style={{
          background: `radial-gradient(600px at ${cursorPos.x}px ${cursorPos.y}px, 
            rgba(87, 84, 255, 0.4) 0%, 
            rgba(0, 89, 255, 0.2) 40%, 
            rgba(76, 0, 255, 0.1) 60%)`,
          opacity: isHovering ? 1 : 0.3,
          transition: "opacity 0.4s ease-out",
        }}
      />

      {/* Main Content */}
      <div className="p-8 pt-2">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.h2
            className="text-4xl font-bold text-white mb-6 tracking-tighter"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{
              delay: 0.2,
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            ProjectMP
          </motion.h2>
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <motion.img
              src={loading}
              alt="Loading"
              className="w-8 h-8 animate-spin"
              animate={{ rotate: 360 }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export default App;
