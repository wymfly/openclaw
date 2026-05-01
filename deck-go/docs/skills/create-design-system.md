# Create Design System — Skill 原文

> 这是 Claude 内置的 "Create design system" skill 的完整指令原文，用作 deck-go 项目的内部参考。
> 来源：通过 `invoke_skill("Create design system")` 调出。
> 注意：这是写给 Claude（执行者）看的工作指令，不是面向人的产品文档，所以语气是命令式的。

---

## 用途

用来**从零搭建或规范化一个 design-system 项目**——把品牌色、字体、组件、UI 复刻、icon、logo 等沉淀成一个可被后续设计任务"当字典查"的独立项目。

design-system 是一个独立的项目，里面装的是**事实**而不是**创作**：

- 输出物：`README.md`（文字规范）+ `tokens.css`（CSS 变量）+ `assets/`（真实 logo / icon / 字体）+ `ui_kits/`（高保真组件复刻）+ `preview/`（一屏可见的 token 卡片）
- 核心动作：**复刻**——能从 codebase / Figma 抠出来的就抠，不自由发挥、不画 SVG
- 使用方式：以后做新模块（deck 列表、settings、editor）时，从这个 design-system 项目读 tokens 和 atoms，保证视觉一致

---

## 完整 Skill 指令原文

Design systems are folders on the file system containing typography guidelines, colors, assets, brand style and tone guides, css styles, and React recreations of UIs, decks, etc. they give design agents the ability to create designs against a company's existing products, and create assets using that company's brand. Design systems should contain real visual assets (logos, brand illustrations, etc), low-level visual foundations (e.g. typography specifics; color system, shadow, border, spacing systems) and also high-level visual ELEMENTS (buttons, full screens) within ui kits.

No need to invoke the create_design_system skill; this is it.

To begin, create a todo list with the tasks below, then follow it:

- Explore provided assets and materials to gain a high-level understanding of the company/product context, the different products represented, etc. Read each asset (codebase, figma, file etc) and see what they do. Find some product copy; examine core screens; find any design system definitions.
- Create a README.md with the high-level understanding of the company/product context, the different products represented, etc. Mention the sources you were given: full Figma links, codebase paths, etc. Do not assume the reader has access, but store in case they do.
- Call set_project_title with a short name derived from the brand/product (e.g. "Acme Design System"). This replaces the generic placeholder so the project is findable.
- IF any slide decks attached, use your repl tool to look at them, extract key assets + text, write to disk.
- Explore the codebase and/or figma design contexts and create a colors_and_type.css file containing CSS vars for both base type + color styles (e.g. fg1, fg2, serif-display, etc) and semantic CSS vars (e.g. h1, h2, code, p). Copy any webfonts or ttfs into fonts/.
- Explore, then update README.md with a CONTENT FUNDAMENTALS section: how is copy written? What is tone, casing, etc? I vs you, etc? are emoji used? What is the vibe? Include specific examples
- Explore, update README.md with VISUAL FOUNDATIONS section that talks about the visual motifs and foundations of the brand. Colors, type, spacing, backgrounds (images? full-bleed? hand-drawn illustrations? repeating patterns/textures? gradients?), animation (easing? fades? bounces? no anims?), hover states (opacity, darker colors, lighter colors?), press states (color? shrink?), borders, inner/outer shadow systems, protection gradients vs capsules, layout rules (fixed elements), use of transparency and blur (when?), color vibe of imagery (warm? cool? b&w? grain?), corner radii, what do cards look like (shadow, rounding, border), etc. whatever else you can think of. answer ALL these questions.
- If you are missing font files, find the nearest match on Google Fonts. Flag this substitution to the user and ask for updated font files.
- As you work, create HTML card files in preview/ that populate the Design System tab. Target ~700×150px each (400px max) — err toward MORE small cards, not fewer dense ones. Split at the sub-concept level: separate cards for primary vs neutral vs semantic colors; display vs body vs mono type; spacing tokens vs a spacing-in-use example; one card per component state cluster. A typical system is 12–20+ cards. Skip titles and framing — the asset name renders OUTSIDE the card, so just show the swatches/specimens/tokens directly with minimal decoration. After writing each batch, call register_assets with items carrying viewport {width: 700, height: <your estimate>}, a one-line subtitle, and a `group` tag so the Design System tab can split cards into sections. Use these groups: "Type" for typography specimens and scales, "Colors" for palettes / color scales / semantic colors, "Spacing" for radii / shadow systems / spacing tokens / elevation, "Components" for buttons / form inputs / cards / badges / menus, "Brand" for logos / imagery / anything that doesn't fit the others. Title-cased, consistent across the batch.
- Copy logos, icons and other visual assets into assets/. update README.md with an ICONOGRAPHY describing the brand's approach to iconography. Answer ALL these and more: are certain icon systems used? is there a builtin icon font? are there SVGs used commonly, or png icons? (if so, copy them in!) Is emoji ever used? Are unicode chars used as icons? Make sure to copy key logos, background images, maybe 1-2 full-bleed generic images, and ALL generic illustrations you find. NEVER draw your own SVGs or generate images; COPY icons programmatically if you can.
- For icons: FIRST copy the codebase's own icon font/sprite/SVGs into assets/ if you can. Otherwise, if the set is CDN-available (e.g. Lucide, Heroicons), link it from CDN. If neither, substitute the closest CDN match (same stroke weight / fill style) and FLAG the substitution. Document usage in ICONOGRAPHY.
- For each product given (E.g. app and website), create UI kits in ui_kits/<product>/{README.md, index.html, Component1.jsx, Component2.jsx}; see the UI kits section. Verify visually. Make one todo list item for each product/surface.
- If you were given a slide template, create sample slides in slides/{index.html, TitleSlide.jsx, ComparisonSlide.jsx, BigQuoteSlide.jsx, etc}. If no sample slides were given, don't create them. Create an HTML file per slide type; if decks were provided, copy their style. Use the visual foundations and bring in logos + other assets. Register each slide HTML via register_assets with viewport {width: 1280, height: 720} so the 16:9 frame scales to fit the card.
- Register each UI kit's index.html as its own card via register_assets with viewport {width: <kit's design width>, height: <above-fold height>} — the declared height caps what's shown, so pick the portion worth previewing.
- Update README.md with a short "index" pointing the reader to the other files available. This should serve as a manifest of the root folder, plus a list of ui kits, etc.
- Create SKILL.md file (details below)
- You are done! The Design System tab shows every registered card. Do NOT summarize your output; just mention CAVEATS (e.g. things you were unable to do or unsure) and have a CLEAR, BOLD ASK for the user to help you ITERATE to make things PERFECT.

### UI kit details

- UI Kits are high-fidelity visual + interaction recreations of interfaces. They cut corners on functionality -- they are not 'real production code' -- but they provide high-fidelity UI components. Your UI kits should be pixel-perfect recreations, created by reading the original UI code if possible, or using figma's get-design-context. They should be modular and reusable, so they can easily be pieced together for real designs. UI kits should recreate key screens in the product as click-thru prototypes. a UI kit's index.html must look like a typical view of the product. These are recreations, not storybooks.
- To start, update the todo list to contain these steps for each product: (1) Explore codebase + components in Figma (design context) and code, (2) Create 3-5 core screens for each product (e.g. homepage or app) with interactive click-thru components, (3) Iterate visually on the designs 1-2x, cross-referencing with design context.
- Figure out the core products from this company/codebase. There may be one, or a few. (e.g. mobile app, marketing website, docs website).
- Each UI kit must contain JSX components (well-factored; small, neat) for core UI elements (e.g. sidebars, composers, file panels, hero units, headers, footers, buttons, fields, menus, blog posts, video players, settings screens, login, etc).
- The index.html file should demonstrate an interactive version of the UI (e.g a chat app would show you a login screen, let you create a chat, send a message, etc, as fake)
- You should get the visuals exactly right, using design context or codebase import. Don't copy component implementations exactly; make simple mainly-cosmetic versions. It's important to copy.
- Focus on good component coverage, not replicating every single section in a design.
- Do not invent new designs for UI kits. The job of the UI kit is to replicate the existing design, not create a new one. Copy the design, don't reinvent it. If you do not see it in the project, omit, or leave purposely blank with a disclaimer.

### Guidance

- Run independently without stopping unless there's a crucial blocker (E.g. lack of Figma access to a pasted link; lack of codebase access).
- When creating slides and UI kits, avoid cutting corners on iconography; instead, copy icon assets in! Do not create halfway representations of iconography using hand-rolled SVG, emoji, etc.
- CRITICAL: Do not recreate UIs from screenshots alone unless you have no other choice! Use the codebase, or Figma's get-design-context, as a source of truth. Screenshots are much lossier than code; use screenshots as a high-level guide but always find components in the codebase if you can!
- Avoid these visual motifs unless you are sure you see them in the codebase or Figma: bluish-purple gradients, emoji cards, cards with rounded corners and colored left-border only
- Avoid reading SVGs -- this is a waste of context! If you know their usage, just copy them and then reference them.
- When using Figma, use get-design-context to understand the design system and components being used. Screenshots are ONLY useful for high-level guidance. Make sure to expand variables and child components to get their content, too. (get_variable_defs)
- Create these files in the ROOT of the project unless asked not to. For example, README.md should be at the root, not in a folder!
- Stop if key resources are unnecessible: ff a codebase was attached or mentioned, but you are unable to access it via local_ls, etc, you MUST stop and ask the user to re-attach it using the Import menu. These get reattached often; do not complete a design system if you get a disconnect! Similarly, if a Figma url is inaccessible, stop and ask the user to rectify. NEVER go ahead spending tons of time making a design system if you cannot access all the resources the user gave you.

### SKILL.md

When you are done, we should make this file cross-compatible with Agent Skills in case the user wants to download it and use it in Claude Code.

Create a SKILL.md file like this:

```markdown
---
name: {brand}-design
description: Use this skill to generate well-branded interfaces and assets for {brand}, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for protoyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
```

Additionally, remind the user they need to set the File type to Design System in the Share menu so that others in their org can view this design system.

---

## 关键摘要（给人看的版本）

### 输出结构

```
<design-system project>/
├── README.md                    # 高层介绍 + Content Fundamentals + Visual Foundations + Iconography + Index
├── colors_and_type.css          # CSS 变量：fg1/fg2/serif-display + 语义 h1/h2/p/code
├── fonts/                       # webfont / ttf 文件
├── assets/                      # logo / icon / 背景图 / 插画（全部从源头 copy，不画）
├── preview/                     # 700×150 的小卡片 HTML，用于 Design System tab 展示
├── ui_kits/<product>/           # 每个产品一个 UI kit
│   ├── README.md
│   ├── index.html               # 可点击的高保真原型（不是 storybook）
│   └── *.jsx                    # 模块化组件
├── slides/                      # （仅当有 slide 模板时）
└── SKILL.md                     # 让这个 design-system 可被当 Agent Skill 用
```

### preview/ 卡片的关键规则

- 每张约 700×150（最大 400 高），**宁多勿密**
- 一个子概念一张卡：primary / neutral / semantic colors 各一张；display / body / mono type 各一张
- 不写标题和装饰——卡片标题由系统在外面渲染
- 一个完整 design-system 通常 12-20+ 张
- 注册时打 group：`Type` / `Colors` / `Spacing` / `Components` / `Brand`

### 反 AI slop 条款（对所有设计任务都适用）

- 不要蓝紫渐变 backgrounds
- 不要 emoji 卡片
- 不要"圆角 + 左侧 accent 色边框"卡片
- 不自己画 SVG icon——找不到就用 Lucide/Heroicons CDN 并 flag 替代
- 不靠截图复刻 UI——能拿到 codebase 或 Figma 一定优先

### 对 deck-go 的现状

当前已经有一个 design-system 子项目（id `019dd7cb-26db-7c33-9b07-97bb50cdfdb7`）。
后续路径建议见 `deck-go/docs/` 里其他文档（如果有），或回到主对话讨论。
