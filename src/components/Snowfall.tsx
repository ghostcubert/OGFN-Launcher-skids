import { useEffect, useState } from "react";

export const Snowfall = () => {
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem("snowfall") === "true";
  });

  useEffect(() => {
    // Check on mount
    const isEnabled = localStorage.getItem("snowfall") === "true";
    setEnabled(isEnabled);

    // Listen for changes
    const handleChange = () => {
      const current = localStorage.getItem("snowfall") === "true";
      setEnabled(current);
    };

    window.addEventListener("snowfall-changed", handleChange);
    window.addEventListener("storage", handleChange);

    // Poll every 500ms as backup
    const interval = setInterval(() => {
      const current = localStorage.getItem("snowfall") === "true";
      if (current !== enabled) {
        setEnabled(current);
      }
    }, 500);

    return () => {
      window.removeEventListener("snowfall-changed", handleChange);
      window.removeEventListener("storage", handleChange);
      clearInterval(interval);
    };
  }, [enabled]);

  if (!enabled) return null;

  const snowflakes = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    animationDuration: 5 + Math.random() * 10,
    animationDelay: Math.random() * 5,
    size: 2 + Math.random() * 4,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {snowflakes.map((flake) => (
        <div
          key={flake.id}
          className="absolute rounded-full bg-white opacity-70"
          style={{
            left: `${flake.left}%`,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            animation: `fall ${flake.animationDuration}s linear infinite`,
            animationDelay: `${flake.animationDelay}s`,
          }}
        />
      ))}
    </div>
  );
};
