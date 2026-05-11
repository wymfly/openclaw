import { useRef, useState, type ReactNode } from "react";
import {
  Badge,
  Banner,
  Block,
  Breadcrumb,
  Button,
  Card,
  Chip,
  Code,
  ContextMenu,
  DiffView,
  Drawer,
  DropdownMenu,
  FileInput,
  IconButton,
  Input,
  JsonTree,
  Markdown,
  Modal,
  Popover,
  ProgressBar,
  Radio,
  SegmentedControl,
  Select,
  SidebarRow,
  SkeletonLoader,
  Slider,
  Spinner,
  StreamingCursor,
  Tab,
  TableView,
  Tag,
  Textarea,
  Toast,
  Toggle,
  Tooltip,
  WaitingDots,
} from "../atoms";
import * as icons from "../icons";
import {
  EmptyState,
  KbdHint,
  KpiStrip,
  NavRail,
  PageShell,
  PanelMetric,
  PanelPill,
  PanelRoot,
  PanelSectionHeader,
  PanelStatusRow,
  PanelSurface,
  SectionHeader,
  TopBar,
} from "../patterns";

/**
 * Dev-only smoke gallery — renders one sample of every atom against the
 * design-system tokens. Reachable via `?dsGallery=1` in dev. Gated by
 * `import.meta.env.DEV` at the loader; never bundled into production.
 */
export function DesignSystemGallery() {
  const [toggleOn, setToggleOn] = useState(false);
  const [seg, setSeg] = useState<"raw" | "bash" | "diff">("bash");
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [popOpen, setPopOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const popAnchorRef = useRef<HTMLButtonElement>(null);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div style={{ padding: 24, display: "grid", gap: 16, maxWidth: 920, margin: "0 auto" }}>
      <Banner variant="info">design-system gallery — Phase 1a + 1b</Banner>

      <Section label="Action">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <IconButton aria-label="search">🔍</IconButton>
      </Section>

      <Section label="Status">
        <Badge variant="ok">ok</Badge>
        <Badge variant="warn">warn</Badge>
        <Badge variant="err">err</Badge>
        <Badge variant="running">running</Badge>
        <Chip>active=false</Chip>
        <Chip active>active=true</Chip>
        <Tag>BASH</Tag>
        <Spinner aria-label="loading" />
        <SkeletonLoader style={{ width: 120, height: 12 }} />
      </Section>

      <Section label="Streaming">
        <StreamingCursor />
        <WaitingDots aria-label="waiting" />
        <ProgressBar aria-label="progress" value={0.42} />
        <ProgressBar aria-label="indeterminate" />
      </Section>

      <Section label="Container">
        <Card>Card · elev surface (default)</Card>
        <Card surface="flat" padded={false}>
          <div style={{ padding: 8 }}>Card · flat, padded=false</div>
        </Card>
        <Block label="Read" summary="src/foo.ts" headActions={<Tag>READ</Tag>}>
          file body
        </Block>
        <Block label="Tool" collapsible defaultOpen={false}>
          collapsible body
        </Block>
        <Button onClick={() => setModalOpen(true)}>Open modal</Button>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} aria-label="Demo modal">
          <h3>Modal</h3>
          <p>Escape closes; scrim closes by default.</p>
          <Button onClick={() => setModalOpen(false)}>Close</Button>
        </Modal>
        <Button onClick={() => setDrawerOpen(true)}>Open drawer</Button>
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          aria-label="Demo drawer"
          scrim
        >
          <div style={{ padding: 16 }}>
            <h3>Drawer</h3>
            <Button onClick={() => setDrawerOpen(false)}>Close</Button>
          </div>
        </Drawer>
      </Section>

      <Section label="Text">
        <Markdown content={"# Title\n\nParagraph with **bold** and `code`.\n\n- a\n- b"} />
        <Code content={"const x = 1;\nconst y = 2;"} language="ts" showLineNumbers />
        <DiffView
          lines={[
            { kind: "context", text: "context" },
            { kind: "del", text: "old" },
            { kind: "add", text: "new" },
          ]}
        />
        <JsonTree value={{ a: 1, list: [1, 2, 3], nested: { x: true } }} />
        <TableView headers={["A", "B"]} rows={[["1", "2"]]} />
      </Section>

      <Section label="Form">
        <Input placeholder="text input" />
        <Textarea placeholder="textarea" rows={3} />
        <Select defaultValue="x">
          <option value="x">X</option>
          <option value="y">Y</option>
        </Select>
        <Toggle aria-label="streaming" checked={toggleOn} onCheckedChange={setToggleOn} />
        <label>
          <Radio name="g" value="a" defaultChecked /> A
        </label>
        <label>
          <Radio name="g" value="b" /> B
        </label>
        <Slider aria-label="vol" min={0} max={100} defaultValue={30} />
        <FileInput>Upload</FileInput>
      </Section>

      <Section label="Navigation">
        <Tab active>active</Tab>
        <Tab>inactive</Tab>
        <Tab muted>muted</Tab>
        <SegmentedControl
          aria-label="View"
          items={[
            { value: "raw", label: "Raw" },
            { value: "bash", label: "Bash" },
            { value: "diff", label: "Diff" },
          ]}
          value={seg}
          onChange={setSeg}
        />
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Atoms" }]} />
        <SidebarRow active title="Active session" preview="last message…" meta="1m ago" />
      </Section>

      <Section label="Overlay">
        <button ref={popAnchorRef} type="button" onClick={() => setPopOpen((v) => !v)}>
          Open popover
        </button>
        <Popover
          open={popOpen}
          onClose={() => setPopOpen(false)}
          anchorRef={popAnchorRef}
          aria-label="Demo popover"
        >
          <div style={{ padding: 12 }}>Popover content</div>
        </Popover>
        <button ref={menuAnchorRef} type="button" onClick={() => setMenuOpen((v) => !v)}>
          Open dropdown
        </button>
        <DropdownMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          anchorRef={menuAnchorRef}
          items={[
            { id: "a", label: "Alpha" },
            { id: "b", label: "Beta", disabled: true },
            { id: "c", label: "Charlie" },
          ]}
          onSelect={() => setMenuOpen(false)}
          aria-label="Choose"
        />
        <Tooltip content="hello">
          <button>hover me</button>
        </Tooltip>
        <Toast variant="success">Saved</Toast>
        <ContextMenu
          aria-label="row"
          items={[
            { id: "x", label: "Copy" },
            { id: "y", label: "Cut", disabled: true },
          ]}
        >
          <div
            style={{
              padding: 12,
              border: "1px dashed var(--ds-border)",
              borderRadius: 6,
            }}
          >
            right-click here
          </div>
        </ContextMenu>
      </Section>

      <Banner variant="info">design-system gallery — Patterns</Banner>

      <Section label="PageShell · NavRail · TopBar (composed shell)">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "64px 1fr",
            border: "1px solid var(--ds-border-subtle)",
            borderRadius: 6,
            overflow: "hidden",
            width: "100%",
            height: 280,
          }}
        >
          <NavRail
            brand={<>D</>}
            items={[
              { id: "a", icon: <icons.IconAgent size={18} />, label: "Agents", onClick: () => {} },
              {
                id: "s",
                icon: <icons.IconStream size={18} />,
                label: "Streams",
                onClick: () => {},
              },
              { id: "k", icon: <icons.IconBolt size={18} />, label: "Skills", onClick: () => {} },
            ]}
            activeId="a"
          />
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <TopBar
              brand="OpenClaw Deck"
              actions={<Button>New</Button>}
              onCommandPaletteOpen={() => {}}
            />
            <PageShell maxWidth="none">
              <p style={{ color: "var(--ds-text-3)" }}>Page content rendered inside PageShell.</p>
            </PageShell>
          </div>
        </div>
      </Section>

      <Section label="EmptyState (3 tones)">
        <EmptyState
          icon={<icons.IconAgent size={28} />}
          title="No agents yet"
          description="Create the first agent to get started."
          action={<Button>Create agent</Button>}
        />
        <EmptyState
          icon={<icons.IconSearch size={28} />}
          title="No matches"
          description='No agents match "ops" with current filters.'
          action={<Button variant="secondary">Clear filters</Button>}
          tone="search"
        />
        <EmptyState
          icon={<icons.IconAlert size={28} />}
          title="Failed to load"
          description="The Gateway agents.list request timed out after 5 seconds."
          action={<Button variant="secondary">Retry</Button>}
          tone="error"
        />
      </Section>

      <Section label="KbdHint (sm + md)">
        <KbdHint keys={["⌘", "K"]} />
        <KbdHint keys={["⌘", "S"]} size="md" />
        <KbdHint keys={["Esc"]} />
        <KbdHint keys={["Shift", "↵"]} aria-label="Shift Enter — send" />
      </Section>

      <Section label="SectionHeader">
        <div style={{ width: "100%" }}>
          <SectionHeader
            title="Identity"
            description="Backend-supported fields. Mirror of the Gateway AgentsUpdateParams contract."
            hint="3 of 5 fields"
            actions={<Button>Save changes</Button>}
          />
        </div>
        <div style={{ width: "100%" }}>
          <SectionHeader title="Skills" hint="whitelist · 3 of 8 enabled" />
        </div>
      </Section>

      <Section label="PanelCockpit">
        <div style={{ width: "100%" }}>
          <PanelRoot aria-label="Panel cockpit sample" density="compact">
            <PanelSectionHeader
              eyebrow="Usage"
              title="Model usage"
              description="Reusable cockpit header, metric strip, surface, status row, and pills."
              actions={
                <PanelStatusRow aria-label="Panel state">
                  <PanelPill tone="positive">ready</PanelPill>
                  <PanelPill>14d</PanelPill>
                </PanelStatusRow>
              }
            />
            <KpiStrip aria-label="Panel metrics" columns={3}>
              <PanelMetric label="Cost" value="$4.75" hint="latest $3.25" />
              <PanelMetric label="Tokens" value="150" hint="input / output" />
              <PanelMetric label="Pressure" value="90%" hint="OpenAI hourly" tone="warning" />
            </KpiStrip>
            <PanelSurface aria-label="Panel surface" tone="elevated">
              <PanelSectionHeader
                headingLevel={3}
                title="Session drilldown"
                meta={<PanelPill tone="accent">2 visible</PanelPill>}
              />
            </PanelSurface>
          </PanelRoot>
        </div>
      </Section>

      <Banner variant="info">design-system gallery — Icons (lucide-react)</Banner>

      <Section
        label={`Icons (${Object.keys(icons).filter((k) => k.startsWith("Icon")).length} canonical)`}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 8,
            width: "100%",
          }}
        >
          {Object.entries(icons)
            .filter(([name]) => name.startsWith("Icon"))
            .toSorted(([a], [b]) => a.localeCompare(b))
            .map(([name, IconComponent]) => {
              const Comp = IconComponent as React.ComponentType<{ size?: number }>;
              return (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    border: "1px solid var(--ds-border-subtle)",
                    borderRadius: 6,
                    background: "var(--ds-bg-1)",
                    color: "var(--ds-text-2)",
                  }}
                >
                  <Comp size={16} />
                  <span style={{ fontFamily: "var(--ds-font-mono)", fontSize: 11 }}>{name}</span>
                </div>
              );
            })}
        </div>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h3 style={{ margin: "8px 0", fontSize: 14, color: "var(--ds-text-2)" }}>{label}</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        {children}
      </div>
    </section>
  );
}
