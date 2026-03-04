const clickSfx = new Audio('/assets/click.mp3');
const hoverSfx = new Audio('/assets/hover.mp3');

export const playClick = () => {
  clickSfx.currentTime = 0;
  clickSfx.play().catch(e => console.error("Audio play failed:", e));
};

export const playHover = () => {
  hoverSfx.currentTime = 0;
  hoverSfx.play().catch(e => console.error("Audio play failed:", e));
};