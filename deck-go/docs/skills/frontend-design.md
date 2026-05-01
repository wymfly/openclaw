# Frontend Design — Skill 原文

> 来源：Claude 内置 skill "Frontend design"，通过 `invoke_skill` 调出。
> 用途：当**没有现有品牌系统**、需要从零定一个有态度的视觉方向时使用。
> 不是"套现成 design-system"，而是"做出审美"。

---

## 完整 Skill 指令原文

Use this guidance when designing frontend/UI work that is NOT governed by an existing brand or design system. Create distinctive HTML with exceptional attention to aesthetic details and creative choices.

### Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. Use these for inspiration but design one that is true to the aesthetic direction.
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

### Aesthetics Guidelines

- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt for distinctive, characterful choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Focus on high-impact moments: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, grain overlays.

Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on the same choices across generations.

Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate animations and effects. Minimalist designs need restraint, precision, and careful attention to spacing and subtle details.

---

## 关键摘要

- **何时用**：从零做新产品/落地页/有 personality 的 UI；目前 deck-go 已有 design-system，**不适用于 deck-go 内部模块**。
- **核心动作**：先定 tone（极端方向）、再定字体（避开 Inter/Arial）、再定调色板（dominant + sharp accent）。
- **禁忌**：每次生成都给一样的东西、用通用字体、用平均化的配色。
