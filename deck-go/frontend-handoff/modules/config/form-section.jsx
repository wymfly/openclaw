// form-section.jsx — Schema-driven form pane (middle column).
//
// Reads schemaLookups for the current section path; renders inline fields
// for leaf children (string/integer/boolean/array) and expandable subsection
// cards for object children. Validation hints come from schema.hint.

const { useMemo, useState } = React;

function getAtPath(obj, path) {
  if (!path) return obj;
  const parts = path.split(".");
  let cursor = obj;
  for (const part of parts) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function setAtPath(obj, path, value) {
  if (!path) return value;
  const parts = path.split(".");
  const next = JSON.parse(JSON.stringify(obj || {}));
  let cursor = next;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof cursor[part] !== "object" || cursor[part] === null) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
  return next;
}

function describeType(child) {
  return Array.isArray(child.type) ? child.type.join(" | ") : child.type || "any";
}

function FormSection({
  draft,
  schemaLookups,
  activeSectionPath,
  dirtyPaths,
  onChange,
  onApplyOpen,
  onResetOpen,
  onRefresh,
  onTogglePreview,
  previewMode,
  baseHash,
  draftHash,
}) {
  const sectionLookup = schemaLookups[activeSectionPath];
  const dirtyHere = useMemo(
    () =>
      dirtyPaths.filter((p) => p === activeSectionPath || p.startsWith(activeSectionPath + "."))
        .length,
    [dirtyPaths, activeSectionPath],
  );

  return (
    <section className="form-section" aria-label={`${activeSectionPath} configuration`}>
      <div className="form-section__head">
        <div>
          <p className="form-section__eyebrow">section</p>
          <h2 className="form-section__title">
            <code>{activeSectionPath}</code>
          </h2>
          <p className="form-section__hint">
            {sectionLookup?.children?.[0]?.hint?.description ||
              "Schema-driven form. Fields write back to the same draft as the raw editor."}
          </p>
        </div>
        <div className="form-section__actions">
          <button type="button" className="ds-btn" onClick={onTogglePreview}>
            <window.IconDiff size={12} />
            <span>{previewMode ? "Hide diff" : "Show diff"}</span>
          </button>
          <button type="button" className="ds-btn" onClick={onRefresh}>
            <window.IconRefresh size={12} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="form-section__hashes">
        <window.HashChip kind="base" hash={baseHash} />
        <window.IconArrowOut size={11} />
        <window.HashChip kind="draft" hash={draftHash} />
        {dirtyHere > 0 ? (
          <window.StatusPill tone="warn" icon={window.IconAlert}>
            {dirtyHere} unsaved here
          </window.StatusPill>
        ) : (
          <window.StatusPill tone="success" icon={window.IconCheck}>
            section clean
          </window.StatusPill>
        )}
      </div>

      <div className="form-section__body">
        {sectionLookup ? (
          <FormGroup
            lookup={sectionLookup}
            schemaLookups={schemaLookups}
            draft={draft}
            dirtyPaths={dirtyPaths}
            onChange={onChange}
            depth={0}
          />
        ) : (
          <p className="form-section__empty">
            No schema lookup available for <code>{activeSectionPath}</code>.
          </p>
        )}
      </div>

      <footer className="form-section__footer">
        <button
          type="button"
          className="ds-btn"
          onClick={onResetOpen}
          disabled={dirtyPaths.length === 0}
        >
          <window.IconUndo size={12} />
          <span>Reset draft</span>
        </button>
        <button
          type="button"
          className="ds-btn ds-btn--primary"
          onClick={onApplyOpen}
          disabled={dirtyPaths.length === 0}
        >
          <window.IconSave size={12} />
          <span>Preview & apply ({dirtyPaths.length})</span>
        </button>
      </footer>
    </section>
  );
}

function FormGroup({ lookup, schemaLookups, draft, dirtyPaths, onChange, depth }) {
  return (
    <div className={`form-group form-group--depth-${depth}`}>
      {lookup.children.map((child) => {
        if (child.hasChildren) {
          return (
            <SubsectionCard
              key={child.path}
              child={child}
              schemaLookups={schemaLookups}
              draft={draft}
              dirtyPaths={dirtyPaths}
              onChange={onChange}
              depth={depth}
            />
          );
        }
        return (
          <FieldRow
            key={child.path}
            child={child}
            value={getAtPath(draft, child.path)}
            dirty={dirtyPaths.includes(child.path)}
            onChange={(next) => onChange(child.path, next)}
          />
        );
      })}
    </div>
  );
}

function SubsectionCard({ child, schemaLookups, draft, dirtyPaths, onChange, depth }) {
  const [open, setOpen] = useState(depth === 0);
  const childLookup = schemaLookups[child.path];
  const localDirty = useMemo(
    () => dirtyPaths.filter((p) => p === child.path || p.startsWith(child.path + ".")).length,
    [dirtyPaths, child.path],
  );
  return (
    <article className={`subsection${open ? " subsection--open" : ""}`}>
      <button
        type="button"
        className="subsection__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="subsection__chevron">
          {open ? <window.IconChevronDown size={12} /> : <window.IconChevronRight size={12} />}
        </span>
        <span className="subsection__head">
          <span className="subsection__label">{child.key}</span>
          <code className="subsection__path">{child.path}</code>
        </span>
        <span className="subsection__meta">
          {child.required ? <window.RequiredDot required /> : null}
          {localDirty > 0 ? <span className="subsection__dirty">{localDirty} edits</span> : null}
          <window.FieldTypeBadge type={describeType(child)} />
        </span>
      </button>
      {open ? (
        <div className="subsection__body">
          {child.hint?.description ? (
            <p className="subsection__hint">{child.hint.description}</p>
          ) : null}
          {childLookup ? (
            <FormGroup
              lookup={childLookup}
              schemaLookups={schemaLookups}
              draft={draft}
              dirtyPaths={dirtyPaths}
              onChange={onChange}
              depth={depth + 1}
            />
          ) : (
            <p className="subsection__empty">
              No schema lookup loaded for <code>{child.path}</code>. Click <em>Refresh</em> to fetch
              from BFF.
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function FieldRow({ child, value, dirty, onChange }) {
  const type = describeType(child);
  const id = `field-${child.path.replace(/\./g, "_")}`;
  const baseProps = { id, "aria-describedby": `${id}-hint` };

  let control;
  if (type === "boolean") {
    control = (
      <label className="ds-toggle">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          {...baseProps}
        />
        <span>{value ? "enabled" : "disabled"}</span>
      </label>
    );
  } else if (child.hint?.enum) {
    control = (
      <select
        className="ds-select"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        {...baseProps}
      >
        {child.hint.enum.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  } else if (type === "integer" || type === "number") {
    control = (
      <input
        className="ds-input"
        type="number"
        value={value ?? ""}
        min={child.hint?.minimum}
        max={child.hint?.maximum}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        {...baseProps}
      />
    );
  } else if (type === "array") {
    control = (
      <textarea
        className="ds-textarea ds-textarea--mono"
        value={Array.isArray(value) ? value.join("\n") : ""}
        rows={Math.max(2, Array.isArray(value) ? value.length : 2)}
        onChange={(e) => onChange(e.target.value.split("\n").filter(Boolean))}
        spellCheck="false"
        {...baseProps}
      />
    );
  } else if (child.hint?.secret) {
    control = (
      <input
        className="ds-input ds-input--mono"
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="$ENV_VAR or literal value"
        {...baseProps}
      />
    );
  } else {
    control = (
      <input
        className="ds-input"
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        {...baseProps}
      />
    );
  }

  let validation = null;
  if (type === "integer" && typeof value === "number") {
    if (child.hint?.minimum !== undefined && value < child.hint.minimum)
      validation = `Minimum ${child.hint.minimum}.`;
    if (child.hint?.maximum !== undefined && value > child.hint.maximum)
      validation = `Maximum ${child.hint.maximum}.`;
  }
  if (child.required && (value === "" || value === null || value === undefined)) {
    validation = "Required.";
  }
  if (
    child.hint?.secret &&
    typeof value === "string" &&
    value &&
    !value.startsWith("$") &&
    value.length < 8
  ) {
    validation = "Likely too short for a real credential — prefer $ENV_VAR.";
  }

  return (
    <div
      className={`field-row${dirty ? " field-row--dirty" : ""}${validation ? " field-row--invalid" : ""}`}
    >
      <div className="field-row__head">
        <label htmlFor={id} className="field-row__label">
          {child.hint?.secret ? <window.IconLock size={11} /> : null}
          {child.key}
          <window.RequiredDot required={child.required} />
        </label>
        <window.FieldTypeBadge type={type} />
        {dirty ? <window.StatusPill tone="warn">unsaved</window.StatusPill> : null}
      </div>
      {child.hint?.description ? (
        <p id={`${id}-hint`} className="field-row__hint">
          {child.hint.description}
        </p>
      ) : null}
      <code className="field-row__path">{child.path}</code>
      <div className="field-row__control">{control}</div>
      {validation ? <p className="field-row__error">{validation}</p> : null}
    </div>
  );
}

Object.assign(window, { FormSection, FormGroup, FieldRow, getAtPath, setAtPath });
