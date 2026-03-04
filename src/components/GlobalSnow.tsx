import { useEffect, useState } from "react";

export const GlobalSnow = () => {
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem("snowEnabled") === "true";
  });

  const [snowflakes, setSnowflakes] = useState<Array<{ id: number; left: number; animationDuration: number; size: number }>>([]);

  useEffect(() => {
    // Check on mount
    const isEnabled = localStorage.getItem("snowEnabled") === "true";
    setEnabled(isEnabled);

    // Listen for changes
    const handleChange = () => {
      const current = localStorage.getItem("snowEnabled") === "true";
      setEnabled(current);
    };

    window.addEventListener("storage", handleChange);
    window.addEventListener("snow-changed", handleChange);

    // Poll every 500ms as backup
    const pollInterval = setInterval(() => {
      const current = localStorage.getItem("snowEnabled") === "true";
      if (current !== enabled) {
        setEnabled(current);
      }
    }, 500);

    return () => {
      window.removeEventListener("storage", handleChange);
      window.removeEventListener("snow-changed", handleChange);
      clearInterval(pollInterval);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setSnowflakes([]);
      return;
    }

    const createSnowflake = () => {
      const newSnowflake = {
        id: Date.now() + Math.random(),
        left: Math.random() * 100,
        animationDuration: 6 + Math.random() * 4, // 6-10 seconds for medium speed
        size: 3 + Math.random() * 3, // 3-6px small white dots
      };
      setSnowflakes(prev => [...prev.slice(-80), newSnowflake]); // Keep max 80 snowflakes
    };

    // Create initial snowflakes
    for (let i = 0; i < 40; i++) {
      setTimeout(createSnowflake, i * 100);
    }

    const interval = setInterval(createSnowflake, 150);
    return () => clearInterval(interval);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9998] overflow-hidden">
      {snowflakes.map(flake => (
        <div
          key={flake.id}
          className="absolute bg-white rounded-full opacity-80"
          style={{
            left: `${flake.left}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            animation: `fall ${flake.animationDuration}s linear`,
          }}
        />
      ))}
    </div>
  );
};
