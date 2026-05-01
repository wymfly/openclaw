# Animated Video — Skill 原文

> 来源：Claude 内置 skill "Animated video"。
> 用途：用时间轴做动效演示（产品介绍、转场动画、loading 状态演示）。

---

## 完整 Skill 指令原文

Create an animated video or motion design piece rendered as an HTML page. Build a timeline-based animation with smooth transitions. Design frame-by-frame sequences with playback controls (play/pause, scrubber). Focus on visual storytelling with the Anthropic brand palette. Export-ready at a fixed aspect ratio (16:9 or 9:16). If you need to know the position of an element (eg to move a cursor or character between elements) use refs to grab the position.

START by calling `copy_starter_component` with `kind: "animations.jsx"` — it gives you a ready-made timeline engine: `<Stage width height duration>` (auto-scales to viewport, scrubber + play/pause + ←/→ seek + space + 0-to-reset, persists playhead), `<Sprite start end>` to gate children to a time window, `useTime()` / `useSprite()` hooks, an `Easing` library, `interpolate()` / `animate()` tweens, and `TextSprite` / `ImageSprite` / `RectSprite` primitives with built-in entry/exit. Read the file after copying and build YOUR scenes by composing Sprites inside a Stage; only fall back to Popmotion (https://unpkg.com/popmotion@11.0.5/dist/popmotion.min.js) if the starter genuinely can't do what you need.

Animations are complex code! Make reusable JSX components for each visual element and each scene. Invest in tweaking the timeline iteratively.

### Animation tips

- **Storytelling is KEY!** Before creating ANYTHING, identify the story arc, key tensions, characters, etc. Align on the message you want to convey. Run it by the user.
- **Use good animation principles**: anticipation, easing, follow-through, exaggeration, all the Disney animator principles.
- **Scenes should have establishing shots** setting the scene (titles/captions if NECESSARY, but prefer to show not tell), followed by heavy zooms on the action. Hard cuts, ken-burns-style zooms, mouse-follows. Most scenes should exist in a realistic context: have a background, exist in computer/phone UI, etc. Elements should generally not float in the aether.
- **In short animations**, most "scenes" are a single shot or a sequence of shots in same setting. Decide what the shot is. Maybe starting zoomed out then zooming in on the action. Maybe rapidly cutting back/forth between two people or graphics in tension. Maybe following a cursor or graph line as it flits around. Be creative!
- **Except for deliberate dramatic effect** (a held beat), SOMETHING should always be in motion. Camera, an element, or a transition — slowly panning, zooming, scaling, drifting, building. A truly static frame reads as a bug. Images especially: always slowly zoom/pan, have action, have text/graphics appearing, or be rapidly cutting in sequence.
- **Whenever you show text or images**, remember pauses for it to sink in—on the order of seconds—before showing something else.

If cursor or pointer movement is depicted, zoom in and follow it with a damped viewport animation, like Screen Studio. Use HTML refs to locate elements onscreen so the cursor points at the right things.

For clarity when commenting, update the video root's `data-screen-label` attr with the current timestamp each second.

---

## 关键摘要

- **画布**：16:9 或 9:16，固定比例。
- **不要自己写时间轴**：用 `copy_starter_component("animations.jsx")`，里面有 Stage / Sprite / 缓动 / Tween 全套。
- **故事先于技术**：先定故事弧、张力、信息要传达什么，再写代码。
- **永远在动**：除非刻意停顿，画面里得有东西在动（相机、元素、过渡）。
- **节奏**：文字/图片出现后停留数秒再切，不要太赶。
