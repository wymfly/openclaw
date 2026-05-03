# API Explorer Components

## Component Tree

```text
ApiExplorerPanel
  ApiExplorerWorkbench
    CatalogColumn
      WorkbenchHeader
      DescribeMetrics
      TabActions
      MethodSearch
      MethodDomainList
        MethodDomainGroup
        MethodCatalogRow
      EventCatalogList
        EventCatalogRow
    DetailColumn
      SelectedMethodHero
      MethodFactGrid
      ParamsSchemaSection
      ResultSchemaSection
      UntypedMethodsSection
    SchemaTree
      SchemaSummaryPills
      SchemaPropertyRow
      NestedSchemaTree
```

## Module-Local Molecules

### Workbench header

- Shows title, description, describe readiness, and live catalog counts.
- Uses the existing read-only contract browser language.

### Describe metric tile

- Compact tile for methods, events, and untyped counts.
- Repeats prior module metric tile molecules but remains local until a dedicated KPI/card proposal defines a shared API.

### Method catalog row

- Button row with method name, scope, since, and selected state.
- Grouped by method domain.
- Long method names wrap in stable constrained regions.

### Event catalog row

- Static row with event name, since, and payload schema section.
- The event tab is inspection-only.

### Selected method detail

- Hero region with method name, scope, and since.
- Fact tiles for scope and since.
- Params/result schema sections.

### Schema tree row

- Displays property name, required marker, type, enum values, and nested expansion when properties/items exist.
- Native button controls drive collapse/expand.
- Bound recursive depth prevents runaway layouts.

### Untyped methods section

- Raw JSON payload or compact list of method names from `untyped`.
- Always visible when untyped methods exist, because this is schema-governance evidence.

## Props / Data Boundaries

The production implementation can remain a single panel file with local helper components. It should not widen public APIs. All data remains internal to `ApiExplorerPanel` and is sourced from `fetchGatewayDescribe()`.
