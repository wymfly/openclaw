// NodesApp — orchestrator: holds inventory + pairing state + selection + action lifecycle.

const NodesApp = () => {
  const [nodes, setNodes] = React.useState(window.NODES);
  const [pairing, setPairing] = React.useState(window.PAIRING_REQUESTS);
  // selectedKey is "node:<nodeId>" or "pair:<requestId>" (used to highlight the rail).
  const [selectedKey, setSelectedKey] = React.useState(
    `pair:${window.PAIRING_REQUESTS[0].requestId}`,
  );
  const [refreshing, setRefreshing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState(null);
  const [actionResult, setActionResult] = React.useState(null);

  // Resolve current target.
  const orphanRequest = (() => {
    if (!selectedKey.startsWith("pair:")) return null;
    const id = selectedKey.slice(5);
    const req = pairing.find((p) => p.requestId === id);
    if (!req) return null;
    const matchedNode = nodes.find((n) => n.nodeId === req.nodeId);
    return matchedNode ? null : req;
  })();
  const selectedNode = (() => {
    if (selectedKey.startsWith("node:")) {
      return nodes.find((n) => n.nodeId === selectedKey.slice(5)) || null;
    }
    if (selectedKey.startsWith("pair:")) {
      const id = selectedKey.slice(5);
      const req = pairing.find((p) => p.requestId === id);
      if (req) return nodes.find((n) => n.nodeId === req.nodeId) || null;
    }
    return null;
  })();
  const pendingForSelected = selectedNode ? pendingFor(selectedNode.nodeId, pairing) : null;

  const onSelectNode = (node) => {
    setSelectedKey(`node:${node.nodeId}`);
    setPendingAction(null);
    setActionResult(null);
  };
  const onSelectPending = (req) => {
    setSelectedKey(`pair:${req.requestId}`);
    setPendingAction(null);
    setActionResult(null);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 320);
  };

  // ----- action runners -----
  const runRename = (name) => {
    setPendingAction({
      label: "Rename",
      hint: `Display name → ${name}`,
      danger: false,
      kind: "rename",
      payload: { name },
    });
  };

  const runInvoke = (args) => {
    setPendingAction({
      label: "Invoke command",
      hint: `${args.command} on ${selectedNode?.displayName || selectedNode?.nodeId} (timeout ${args.timeoutMs} ms)`,
      danger: false,
      kind: "invoke",
      payload: args,
    });
  };

  const runPendingEnqueue = (args) => {
    setPendingAction({
      label: "Queue work",
      hint: `${args.type} (${args.priority}) on ${selectedNode?.displayName || selectedNode?.nodeId}`,
      danger: false,
      kind: "pending",
      payload: args,
    });
  };

  const runPairAction = (kind, request, target, token) => {
    if (kind === "approve") {
      setPendingAction({
        label: "Approve pairing",
        hint: `Approve ${request.displayName || request.nodeId} (${request.requestId})`,
        danger: false,
        kind: "pair.approve",
        payload: { requestId: request.requestId, request },
      });
    } else if (kind === "reject") {
      setPendingAction({
        label: "Reject pairing",
        hint: `Reject ${request.displayName || request.nodeId}. Device must restart pairing flow.`,
        danger: true,
        kind: "pair.reject",
        payload: { requestId: request.requestId, request },
      });
    } else if (kind === "request") {
      setPendingAction({
        label: "Request pairing",
        hint: `Send pairing request for ${target.displayName || target.nodeId}.`,
        danger: false,
        kind: "pair.request",
        payload: {
          input: {
            nodeId: target.nodeId,
            displayName: target.displayName,
            platform: target.platform,
          },
        },
      });
    } else if (kind === "verify") {
      setPendingAction({
        label: "Verify token",
        hint: `Verify token for ${target.displayName || target.nodeId}.`,
        danger: false,
        kind: "pair.verify",
        payload: { nodeId: target.nodeId, token },
      });
    }
  };

  const onCancelConfirm = () => setPendingAction(null);

  const onConfirm = () => {
    if (!pendingAction) return;
    setBusy(true);
    const action = pendingAction;
    setPendingAction(null);
    setTimeout(() => {
      let result = null;
      if (action.kind === "rename" && selectedNode) {
        const updated = { ...selectedNode, displayName: action.payload.name };
        setNodes((cur) => cur.map((n) => (n.nodeId === selectedNode.nodeId ? updated : n)));
        result = {
          heading: "Renamed",
          subhead: `→ ${action.payload.name}`,
          atMs: Date.now(),
          payload: ACTION_FIXTURES.rename(selectedNode.nodeId, action.payload.name),
        };
      } else if (action.kind === "invoke" && selectedNode) {
        result = {
          heading: "Invoked",
          subhead: action.payload.command,
          atMs: Date.now(),
          payload: ACTION_FIXTURES.invoke(
            selectedNode.nodeId,
            action.payload.command,
            action.payload.params,
          ),
        };
      } else if (action.kind === "pending" && selectedNode) {
        result = {
          heading: "Queued",
          subhead: `${action.payload.type} (${action.payload.priority})`,
          atMs: Date.now(),
          payload: ACTION_FIXTURES.pendingEnqueue(
            selectedNode.nodeId,
            action.payload.type,
            action.payload.priority,
            action.payload.wake,
          ),
        };
      } else if (action.kind === "pair.approve") {
        const req = action.payload.request;
        // Mark node as paired (bring connection up).
        setNodes((cur) =>
          cur.map((n) =>
            n.nodeId === req.nodeId
              ? { ...n, paired: true, connected: true, connectedAtMs: Date.now() }
              : n,
          ),
        );
        // Drop request.
        setPairing((cur) => cur.filter((p) => p.requestId !== req.requestId));
        result = {
          heading: "Pairing approved",
          subhead: req.displayName || req.nodeId,
          atMs: Date.now(),
          payload: ACTION_FIXTURES.pairApprove(req.requestId),
        };
        // Re-select the now-paired node.
        const stillExists = nodes.find((n) => n.nodeId === req.nodeId);
        if (stillExists) setSelectedKey(`node:${req.nodeId}`);
      } else if (action.kind === "pair.reject") {
        const req = action.payload.request;
        setPairing((cur) => cur.filter((p) => p.requestId !== req.requestId));
        result = {
          heading: "Pairing rejected",
          subhead: req.displayName || req.nodeId,
          atMs: Date.now(),
          payload: ACTION_FIXTURES.pairReject(req.requestId),
        };
        // If we were on the orphan/pair view, fall back to first node.
        if (nodes.length > 0) setSelectedKey(`node:${nodes[0].nodeId}`);
      } else if (action.kind === "pair.request") {
        const fixture = ACTION_FIXTURES.pairRequest(action.payload.input);
        setPairing((cur) => [fixture.request, ...cur]);
        result = {
          heading: "Pairing requested",
          subhead: action.payload.input.displayName || action.payload.input.nodeId,
          atMs: Date.now(),
          payload: fixture,
        };
      } else if (action.kind === "pair.verify") {
        const fixture = ACTION_FIXTURES.pairVerify(action.payload.nodeId, action.payload.token);
        if (fixture.status === "verified") {
          setNodes((cur) =>
            cur.map((n) =>
              n.nodeId === action.payload.nodeId
                ? { ...n, paired: true, connected: true, connectedAtMs: Date.now() }
                : n,
            ),
          );
        }
        result = {
          heading: fixture.status === "verified" ? "Token verified" : "Token rejected",
          subhead: action.payload.nodeId,
          atMs: Date.now(),
          payload: fixture,
        };
      }
      if (result) setActionResult(result);
      setBusy(false);
    }, 360);
  };

  // Top-rail "Request pairing…" — opens an inline mock that requests for the selected node, or for a stub.
  const onPairRequestNew = () => {
    if (selectedNode && !selectedNode.paired) {
      runPairAction("request", null, selectedNode);
      return;
    }
    // Fallback: stub a brand-new device.
    runPairAction("request", null, {
      nodeId: `node-stub-${Math.random().toString(36).slice(2, 7)}`,
      displayName: "New device",
      platform: "darwin",
    });
  };

  return (
    <div className="nodes-app">
      <NodesRail
        nodes={nodes}
        pairing={pairing}
        selectedKey={selectedKey}
        onSelectNode={onSelectNode}
        onSelectPending={onSelectPending}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onPairRequest={onPairRequestNew}
      />
      <NodeDetail
        node={selectedNode}
        pending={pendingForSelected}
        pairingMode={orphanRequest}
        onRename={runRename}
        onPairAction={runPairAction}
        onInvoke={runInvoke}
        onPendingEnqueue={runPendingEnqueue}
        pendingAction={pendingAction}
        onConfirm={onConfirm}
        onCancelConfirm={onCancelConfirm}
        actionResult={actionResult}
        busy={busy}
      />
      <TweaksPanel />
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<NodesApp />);
