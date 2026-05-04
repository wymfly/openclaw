// MemoryBrowser — Browse tab. 2-pane workspace: file system tree (left) +
// content viewer (right). Tree paths come from BROWSE_TREE; opening a
// directory triggers a virtual lookup (not a real network call).

const FileTreeNode = ({ node, depth, expanded, onToggle, onSelect, selectedPath }) => {
  const isOpen = expanded.has(node.path);
  const children = isOpen ? BROWSE_TREE[node.path] || [] : [];
  const isFile = node.type === "file";
  const indent = depth * 14;

  return (
    <>
      <button
        className={`fs-node ${selectedPath === node.path ? "fs-node--on" : ""}`}
        style={{ paddingLeft: 8 + indent }}
        onClick={() => (isFile ? onSelect(node.path) : onToggle(node.path))}
      >
        <span className="fs-node__chevron">
          {!isFile && (isOpen ? <IconChevronD /> : <IconChevronR />)}
        </span>
        <span className="fs-node__icon">{isFile ? <IconFile /> : <IconFolder />}</span>
        <span className="fs-node__name">{node.name}</span>
        {isFile && <SizeChip bytes={node.size} />}
      </button>
      {!isFile &&
        isOpen &&
        children.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onSelect={onSelect}
            selectedPath={selectedPath}
          />
        ))}
    </>
  );
};

const MemoryBrowser = () => {
  const [expanded, setExpanded] = React.useState(() => new Set(["/", "/global", "/agents"]));
  const [selectedPath, setSelectedPath] = React.useState("/MEMORY.md");
  const [copied, setCopied] = React.useState(false);

  const toggle = (path) => {
    setExpanded((curr) => {
      const next = new Set(curr);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const root = BROWSE_TREE["/"] || [];
  const content = FILE_CONTENTS[selectedPath];

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedPath).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const totalFiles = Object.values(BROWSE_TREE)
    .flat()
    .filter((n) => n.type === "file").length;
  const totalBytes = Object.values(BROWSE_TREE)
    .flat()
    .filter((n) => n.type === "file")
    .reduce((sum, n) => sum + (n.size || 0), 0);

  return (
    <div className="memory-browser">
      <aside className="memory-browser__tree">
        <div className="memory-browser__tree-head">
          <h3 className="memory-browser__tree-title">
            <IconMemory />
            Memory store
          </h3>
          <span className="muted small">
            {totalFiles} files · {formatSize(totalBytes)}
          </span>
        </div>
        <div className="memory-browser__tree-body">
          {root.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={toggle}
              onSelect={setSelectedPath}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      </aside>
      <section className="memory-browser__viewer">
        <header className="memory-browser__viewer-head">
          <div className="memory-browser__viewer-crumbs">
            {selectedPath
              .split("/")
              .filter(Boolean)
              .map((seg, i, arr) => {
                const path = "/" + arr.slice(0, i + 1).join("/");
                const isLast = i === arr.length - 1;
                return (
                  <React.Fragment key={path}>
                    {i > 0 && <IconChevronR />}
                    <span
                      className={
                        isLast
                          ? "memory-browser__crumb memory-browser__crumb--current"
                          : "memory-browser__crumb"
                      }
                    >
                      {seg}
                    </span>
                  </React.Fragment>
                );
              })}
          </div>
          <div className="memory-browser__viewer-actions">
            <button className="memory-browser__path-chip" onClick={handleCopy}>
              <IconHash />
              <code>{selectedPath}</code>
              <IconCopy />
              {copied && <span className="memory-browser__path-copied">copied</span>}
            </button>
          </div>
        </header>
        {content ? (
          <div className="memory-browser__content">
            <MarkdownView source={content} />
          </div>
        ) : (
          <div className="memory-browser__empty">
            <p className="muted">Select a file to view its content.</p>
          </div>
        )}
      </section>
    </div>
  );
};

Object.assign(window, { MemoryBrowser });
