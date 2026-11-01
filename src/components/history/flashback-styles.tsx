/*
 * Flashback's own CSS. This project compiles every .css file as global Tailwind CSS (see next.config), so CSS
 * modules are not available; React 19 hoists and dedupes this <style> into <head> instead. Classes are prefixed fb-.
 *
 * Tiles recolour with a short west-to-east sweep (east-to-west going back in time): each tile's --d is its delay.
 * States that change sides bounce once. Only colour, transform and opacity move.
 */
const CSS = `
.fb-tile {
  transition-property: background-color, color, transform;
  transition-duration: 320ms, 320ms, 160ms;
  transition-timing-function: var(--ease-map), var(--ease-map), ease-out;
  transition-delay: var(--d, 0ms), var(--d, 0ms), 0ms;
}
@keyframes fb-flip-a { 0% { transform: scale(1); } 45% { transform: scale(1.18); } 100% { transform: scale(1); } }
@keyframes fb-flip-b { 0% { transform: scale(1); } 45% { transform: scale(1.18); } 100% { transform: scale(1); } }
.fb-flip-a { animation: fb-flip-a 440ms var(--ease-roll) calc(var(--d, 0ms) + 80ms) 1 both; }
.fb-flip-b { animation: fb-flip-b 440ms var(--ease-roll) calc(var(--d, 0ms) + 80ms) 1 both; }

.fb-range { -webkit-appearance: none; appearance: none; display: block; width: 100%; height: 2rem; margin: 0; background: transparent; cursor: pointer; }
.fb-range:focus { outline: none; }
.fb-range::-webkit-slider-runnable-track { height: 6px; border-radius: 3px; background: var(--s4); }
.fb-range::-moz-range-track { height: 6px; border-radius: 3px; background: var(--s4); }
.fb-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 22px; height: 22px; margin-top: -8px; border-radius: 9999px;
  border: 3px solid var(--card); background: var(--signal); transition: transform 120ms ease-out;
}
.fb-range::-moz-range-thumb { width: 16px; height: 16px; border-radius: 9999px; border: 3px solid var(--card); background: var(--signal); }
.fb-range:active::-webkit-slider-thumb { transform: scale(1.12); }
.fb-range:focus-visible::-webkit-slider-thumb { outline: 2px solid var(--ink); outline-offset: 2px; }
.fb-range:focus-visible::-moz-range-thumb { outline: 2px solid var(--ink); outline-offset: 2px; }

/* Tick labels sit under the thumb's centre: inset by half the thumb on each side. */
.fb-ticks { position: relative; height: 1.25rem; margin: 0 11px; }
.fb-tick { position: absolute; top: 0; transform: translateX(-50%); white-space: nowrap; }

@media (prefers-reduced-motion: reduce) {
  .fb-tile { transition-delay: 0ms !important; }
  .fb-flip-a, .fb-flip-b { animation: none !important; }
}
`;

export function FlashbackStyles() {
  return (
    <style href="flashback" precedence="medium">
      {CSS}
    </style>
  );
}
