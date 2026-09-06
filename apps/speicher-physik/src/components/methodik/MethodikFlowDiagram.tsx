export type MethodikFlowNode = {
  label: string;
  join?: string | readonly string[];
};

function joinLines(node: MethodikFlowNode): readonly string[] {
  if (node.join == null) return [];
  return typeof node.join === "string" ? [node.join] : node.join;
}

function markerIdFor(nodes: readonly MethodikFlowNode[]): string {
  const key = nodes
    .map((node) => `${node.label}-${joinLines(node).join("-")}`)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `methodik-flow-${key || "arrow"}`;
}

export function MethodikFlowDiagram({
  nodes,
  caption,
}: {
  nodes: readonly MethodikFlowNode[];
  caption?: string;
}) {
  const markerId = markerIdFor(nodes);
  const width = 320;
  const boxHeight = 64;
  const gap = 32;
  const heights = nodes.map((node) => {
    const extras = joinLines(node).length;
    const stacked = node.label.split("\n").length;
    if (extras === 0 && stacked <= 1) return boxHeight;
    if (extras === 0) return 24 + stacked * 22;
    return 52 + extras * 28;
  });
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    gap * (nodes.length - 1) +
    8;

  const layouts = heights.reduce<
    { y: number; height: number; arrowStart: number; arrowEnd: number }[]
  >((items, height) => {
    const y = items.length === 0 ? 4 : items[items.length - 1].y + items[items.length - 1].height + gap;
    return [
      ...items,
      {
        y,
        height,
        arrowStart: y + height,
        arrowEnd: y + height + gap - 4,
      },
    ];
  }, []);

  return (
    <figure className="my-6">
      <div className="border border-line bg-surface px-3 py-4 sm:px-5">
        <svg
          viewBox={`0 0 ${width} ${totalHeight}`}
          className="mx-auto h-auto w-full max-w-sm"
          role="img"
          aria-label={
            caption ?? nodes.map((node) => node.label).join(", dann ")
          }
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-line-strong)" />
            </marker>
          </defs>
          {nodes.map((node, index) => {
            const layout = layouts[index];
            const next = nodes[index + 1];

            return (
              <g key={`${node.label}-${index}`}>
                <rect
                  x={20}
                  y={layout.y}
                  width={width - 40}
                  height={layout.height}
                  fill="var(--color-surface)"
                  stroke="var(--color-line)"
                  strokeWidth="1"
                  rx="2"
                />
                <foreignObject
                  x={20}
                  y={layout.y}
                  width={width - 40}
                  height={layout.height}
                >
                  <div
                    style={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      padding: "8px 14px",
                      color: "var(--color-ink)",
                      fontFamily: "Arial, Helvetica, sans-serif",
                      fontSize: "13px",
                      lineHeight: 1.35,
                    }}
                  >
                    <span style={{ whiteSpace: "pre-line" }}>{node.label}</span>
                    {joinLines(node).map((line) => (
                      <span key={line}>
                        <span
                          style={{
                            color: "var(--color-ink-muted)",
                            display: "block",
                            margin: "4px 0",
                          }}
                        >
                          +
                        </span>
                        <span>{line}</span>
                      </span>
                    ))}
                  </div>
                </foreignObject>
                {next ? (
                  <line
                    x1={width / 2}
                    y1={layout.arrowStart}
                    x2={width / 2}
                    y2={layout.arrowEnd}
                    stroke="var(--color-line-strong)"
                    strokeWidth="1.25"
                    markerEnd={`url(#${markerId})`}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      {caption ? (
        <figcaption className="mt-2 max-w-reading text-xs leading-relaxed text-ink-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
