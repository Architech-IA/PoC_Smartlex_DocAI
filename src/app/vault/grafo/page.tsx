'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

interface GNode {
  id: string;
  label: string;
  tipo: string;
  area: string;
  estado: string;
  cliente: string | null;
  createdAt: string;
}

interface GEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  tipo: string;
}

interface GraphData {
  nodes: GNode[];
  edges: GEdge[];
  totalNodes: number;
  totalEdges: number;
  calculado: boolean;
}

const COMMUNITY_COLORS = [
  '#818cf8', '#34d399', '#f59e0b', '#60a5fa',
  '#f87171', '#a78bfa', '#2dd4bf', '#fb923c',
  '#e879f9', '#4ade80', '#facc15', '#38bdf8',
  '#c084fc', '#6ee7b7', '#fcd34d',
];

const ESTADO_COLOR: Record<string, string> = {
  LISTO: '#34d399', PROCESANDO: '#f59e0b',
  ERROR: '#f87171', ARCHIVADO: '#6b7280',
};

export default function VaultGrafoPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<unknown>(null);
  const graphRef = useRef<unknown>(null);
  const fa2Ref = useRef<ReturnType<typeof setInterval> | null>(null);

  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [selected, setSelected] = useState<GNode | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [communityMap, setCommunityMap] = useState<Record<string, number>>({});
  const [settling, setSettling] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/vault/grafo');
      const d: GraphData = await r.json();
      setData(d);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const recalcular = async () => {
    setComputing(true);
    try {
      await fetch('/api/vault/grafo/recalcular', { method: 'POST' });
      await fetchData();
    } catch { /* ignore */ }
    finally { setComputing(false); }
  };

  // ── Init Sigma once data is ready ─────────────────────────────────────────
  useEffect(() => {
    if (!data || !containerRef.current || data.nodes.length === 0) return;

    let destroyed = false;

    async function init() {
      const [
        { default: Graph },
        { Sigma },
        { default: louvain },
        { default: forceAtlas2 },
        circularMod,
      ] = await Promise.all([
        import('graphology'),
        import('sigma'),
        import('graphology-communities-louvain'),
        import('graphology-layout-forceatlas2'),
        import('graphology-layout/circular'),
      ]);

      // graphology-layout/circular uses export= so the fn is on .default or the module itself
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const circular: { assign: (g: unknown, opts: unknown) => void } = (circularMod as any).default ?? (circularMod as any);

      if (destroyed || !containerRef.current) return;

      // ── Build graph ────────────────────────────────────────────────────────
      const graph = new Graph({ multi: false, type: 'undirected' });
      graphRef.current = graph;

      // Apply search/tipo filter to nodes
      const visibleIds = new Set(
        data!.nodes
          .filter(n =>
            (!filterTipo || n.tipo === filterTipo) &&
            (!search || n.label.toLowerCase().includes(search.toLowerCase()))
          )
          .map(n => n.id)
      );

      data!.nodes.forEach(n => {
        if (!visibleIds.has(n.id)) return;
        graph.addNode(n.id, { label: n.label, tipo: n.tipo, area: n.area, estado: n.estado, cliente: n.cliente });
      });

      data!.edges.forEach(e => {
        if (!visibleIds.has(e.source) || !visibleIds.has(e.target)) return;
        if (graph.hasEdge(e.source, e.target)) return;
        graph.addEdge(e.source, e.target, { weight: e.weight, tipo: e.tipo });
      });

      // ── Louvain community detection ───────────────────────────────────────
      const communities: Record<string, number> = louvain(graph);
      setCommunityMap(communities);

      // ── Assign initial positions + attributes ─────────────────────────────
      circular.assign(graph, { scale: 300 });

      graph.forEachNode((node) => {
        const community = communities[node] ?? 0;
        const color = COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
        const degree = graph.degree(node);
        const size = Math.max(3, Math.min(16, 3 + degree * 1.8));
        graph.setNodeAttribute(node, 'color', color);
        graph.setNodeAttribute(node, 'size', size);
        graph.setNodeAttribute(node, 'borderColor', '#ffffff22');
      });

      graph.forEachEdge((edge) => {
        graph.setEdgeAttribute(edge, 'color', 'rgba(255,255,255,0.08)');
        graph.setEdgeAttribute(edge, 'size', 0.6);
      });

      // ── Init Sigma ────────────────────────────────────────────────────────
      const sigma = new Sigma(graph, containerRef.current!, {
        renderEdgeLabels: false,
        labelColor: { color: '#94a3b8' },
        labelSize: 11,
        labelWeight: '400',
        defaultNodeColor: '#818cf8',
        defaultEdgeColor: 'rgba(255,255,255,0.08)',
        minCameraRatio: 0.05,
        maxCameraRatio: 8,
        allowInvalidContainer: true,
      });

      sigmaRef.current = sigma;

      // ── Interactions ──────────────────────────────────────────────────────
      sigma.on('enterNode', ({ node }: { node: string }) => {
        setHoveredId(node);
        graph.setNodeAttribute(node, 'highlighted', true);
        sigma.refresh();
      });

      sigma.on('leaveNode', ({ node }: { node: string }) => {
        setHoveredId(null);
        graph.setNodeAttribute(node, 'highlighted', false);
        sigma.refresh();
      });

      sigma.on('clickNode', ({ node }: { node: string }) => {
        const n = data!.nodes.find(n => n.id === node);
        setSelected(prev => prev?.id === node ? null : (n ?? null));

        // Highlight neighbors
        graph.forEachEdge((edge, attrs, source, target) => {
          const isConnected = source === node || target === node;
          graph.setEdgeAttribute(edge, 'color', isConnected
            ? 'rgba(255,255,255,0.35)'
            : 'rgba(255,255,255,0.04)');
        });
        sigma.refresh();
      });

      sigma.on('clickStage', () => {
        setSelected(null);
        graph.forEachEdge((edge) => {
          graph.setEdgeAttribute(edge, 'color', 'rgba(255,255,255,0.08)');
        });
        sigma.refresh();
      });

      // ── ForceAtlas2 settling animation ────────────────────────────────────
      const fa2Settings = {
        gravity: 1.2,
        scalingRatio: 3,
        slowDown: 8,
        barnesHutOptimize: graph.order > 200,
        barnesHutTheta: 0.5,
        outboundAttractionDistribution: false,
        adjustSizes: false,
        edgeWeightInfluence: 0.5,
      };

      let iter = 0;
      const maxIter = 500;

      // Run initial batch synchronously for fast first render
      forceAtlas2.assign(graph, { iterations: 80, settings: fa2Settings });
      sigma.refresh();

      // Continue settling
      const intervalId = setInterval(() => {
        if (destroyed || iter >= maxIter) {
          clearInterval(intervalId);
          setSettling(false);
          return;
        }
        forceAtlas2.assign(graph, { iterations: 10, settings: fa2Settings });
        sigma.refresh();
        iter += 10;
        if (iter >= maxIter) setSettling(false);
      }, 50);

      fa2Ref.current = intervalId;
    }

    init();

    return () => {
      destroyed = true;
      if (fa2Ref.current) clearInterval(fa2Ref.current);
      if (sigmaRef.current) (sigmaRef.current as { kill(): void }).kill();
      sigmaRef.current = null;
      graphRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filterTipo, search]);

  // ── Neighbors of selected node ────────────────────────────────────────────
  const neighbors = selected && data ? data.edges
    .filter(e => e.source === selected.id || e.target === selected.id)
    .map(e => {
      const neighborId = e.source === selected.id ? e.target : e.source;
      return { node: data.nodes.find(n => n.id === neighborId), score: e.weight };
    })
    .filter(x => x.node)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    : [];

  const tipos = data ? [...new Set(data.nodes.map(n => n.tipo))].sort() : [];
  const communities = [...new Set(Object.values(communityMap))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#050b15', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, background: 'rgba(5,11,21,0.95)', zIndex: 20, flexWrap: 'wrap' }}>
        <Link href="/vault" style={{ color: '#475569', fontSize: '.8em', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Vault
        </Link>
        <span style={{ color: '#818cf8', fontWeight: 700, fontSize: '.9em' }}>🕸 Grafo de conexiones</span>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nodo…"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '5px 10px', color: '#94a3b8', fontSize: '.78em', outline: 'none', width: 160 }} />

        {/* Tipo filter */}
        {tipos.length > 1 && (
          <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '5px 8px', color: '#94a3b8', fontSize: '.78em', outline: 'none' }}>
            <option value="">Todos los tipos</option>
            {tipos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {settling && <span style={{ fontSize: '.7em', color: '#334155', animation: 'pulse 1s infinite' }}>Calculando posiciones…</span>}
          {data && (
            <span style={{ fontSize: '.72em', color: '#334155' }}>
              {data.totalNodes} nodos · {data.totalEdges} conexiones · {communities.length} clusters
            </span>
          )}
          {data && !data.calculado && (
            <button onClick={recalcular} disabled={computing}
              style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)', border: 'none', borderRadius: 7, padding: '5px 12px', color: '#fff', fontSize: '.75em', fontWeight: 600, cursor: computing ? 'wait' : 'pointer', opacity: computing ? 0.7 : 1 }}>
              {computing ? 'Calculando…' : '⚡ Calcular conexiones'}
            </button>
          )}
          {data?.calculado && (
            <button onClick={recalcular} disabled={computing}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '5px 12px', color: '#475569', fontSize: '.75em', cursor: computing ? 'wait' : 'pointer' }}>
              {computing ? 'Recalculando…' : '↺ Recalcular'}
            </button>
          )}
        </div>
      </div>

      {/* Main */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Graph canvas */}
        <div ref={containerRef} style={{ flex: 1, position: 'relative', background: '#050b15' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: '2em' }}>🕸</div>
              <div style={{ fontSize: '.9em' }}>Cargando grafo…</div>
            </div>
          )}
          {!loading && data && !data.calculado && data.totalEdges === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: '2.5em' }}>🧩</div>
              <div style={{ fontSize: '.9em', color: '#475569', textAlign: 'center' }}>
                Todavía no hay conexiones calculadas.<br />
                <span style={{ color: '#334155', fontSize: '.9em' }}>Presioná "⚡ Calcular conexiones" para generar el grafo.</span>
              </div>
              <button onClick={recalcular} disabled={computing}
                style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)', border: 'none', borderRadius: 8, padding: '9px 20px', color: '#fff', fontWeight: 600, cursor: computing ? 'wait' : 'pointer', fontSize: '.88em' }}>
                {computing ? 'Calculando…' : '⚡ Calcular conexiones'}
              </button>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        {selected && (
          <div style={{ width: 300, borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(5,11,21,0.97)', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, background: 'rgba(5,11,21,0.97)', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '.92em', lineHeight: 1.3, wordBreak: 'break-word' }}>{selected.label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                    <span style={{ fontSize: '.68em', padding: '2px 7px', borderRadius: 999, background: 'rgba(129,140,248,0.15)', color: '#818cf8' }}>{selected.tipo}</span>
                    {selected.area && <span style={{ fontSize: '.68em', padding: '2px 7px', borderRadius: 999, background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>{selected.area}</span>}
                    <span style={{ fontSize: '.68em', padding: '2px 7px', borderRadius: 999, background: (ESTADO_COLOR[selected.estado] ?? '#64748b') + '22', color: ESTADO_COLOR[selected.estado] ?? '#64748b' }}>{selected.estado}</span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', flexShrink: 0, fontSize: '1.1em' }}>✕</button>
              </div>
              {selected.cliente && (
                <div style={{ marginTop: 8, fontSize: '.75em', color: '#60a5fa' }}>👤 {selected.cliente}</div>
              )}
              <Link href={`/vault`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: '.73em', color: '#818cf8', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(129,140,248,0.3)', background: 'rgba(129,140,248,0.08)' }}>
                Ver en Vault →
              </Link>
            </div>

            {/* Neighbors */}
            <div style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: '.7em', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                Documentos relacionados ({neighbors.length})
              </div>
              {neighbors.length === 0 && (
                <div style={{ fontSize: '.8em', color: '#334155' }}>Sin conexiones visibles.</div>
              )}
              {neighbors.map(({ node: n, score }) => {
                if (!n) return null;
                const community = communityMap[n.id] ?? 0;
                const color = COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
                return (
                  <div key={n.id} onClick={() => setSelected(n)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, cursor: 'pointer', padding: '7px 8px', borderRadius: 7, transition: 'background .1s', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '.8em', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                        <span style={{ fontSize: '.65em', color: '#475569' }}>{n.tipo}</span>
                        <span style={{ fontSize: '.65em', color: '#334155' }}>{(score * 100).toFixed(0)}% similitud</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        {data && communities.length > 0 && !selected && (
          <div style={{ position: 'absolute', bottom: 20, left: 20, background: 'rgba(5,11,21,0.88)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px', maxWidth: 180, backdropFilter: 'blur(8px)' }}>
            <div style={{ fontSize: '.68em', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>Clusters</div>
            {communities.slice(0, 10).map(c => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: COMMUNITY_COLORS[c % COMMUNITY_COLORS.length], flexShrink: 0 }} />
                <span style={{ fontSize: '.72em', color: '#475569' }}>Cluster {c + 1}</span>
              </div>
            ))}
          </div>
        )}

        {/* Hint */}
        {!loading && !selected && data && data.totalEdges > 0 && (
          <div style={{ position: 'absolute', bottom: 20, right: 20, background: 'rgba(5,11,21,0.7)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: '7px 12px', fontSize: '.7em', color: '#334155' }}>
            Scroll → zoom · Drag → mover · Click nodo → detalles
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  );
}
