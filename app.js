const state = {
  records: [],
  filtered: [],
  selectedId: null,
  query: "",
  type: "all"
};

const els = {
  docCount: document.querySelector("#doc-count"),
  edgeCount: document.querySelector("#edge-count"),
  clusterCount: document.querySelector("#cluster-count"),
  query: document.querySelector("#query"),
  filters: document.querySelector("#filters"),
  resultCount: document.querySelector("#result-count"),
  questionList: document.querySelector("#question-list"),
  detailTitle: document.querySelector("#detail-title"),
  detailType: document.querySelector("#detail-type"),
  detailQuestion: document.querySelector("#detail-question"),
  detailAnswer: document.querySelector("#detail-answer"),
  hopList: document.querySelector("#hop-list"),
  aqlCode: document.querySelector("#aql-code"),
  copyAql: document.querySelector("#copy-aql"),
  clusterList: document.querySelector("#cluster-list"),
  graph: document.querySelector("#graph")
};

async function boot() {
  const res = await fetch("./data/questions.json");
  state.records = await res.json();
  state.selectedId = state.records[0]?._id ?? null;

  els.query.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  renderFilters();

  els.copyAql.addEventListener("click", async () => {
    await navigator.clipboard.writeText(els.aqlCode.textContent);
    els.copyAql.textContent = "已复制";
    setTimeout(() => {
      els.copyAql.textContent = "复制";
    }, 1200);
  });

  render();
}

function renderFilters() {
  const types = ["all", ...new Set(state.records.map((record) => record.type).filter(Boolean))];
  els.filters.innerHTML = "";

  for (const type of types) {
    const button = document.createElement("button");
    button.className = `filter${type === state.type ? " active" : ""}`;
    button.dataset.type = type;
    button.textContent = type === "all" ? "全部" : type;
    button.addEventListener("click", () => {
      state.type = type;
      renderFilters();
      render();
    });
    els.filters.appendChild(button);
  }
}

function render() {
  state.filtered = state.records.filter((record) => {
    const typeMatch = state.type === "all" || record.type === state.type;
    const haystack = [
      record.question,
      record.answer,
      record.type,
      ...record.context.flatMap((item) => [item.title, ...item.content]),
      ...record.evidences.flatMap((item) => [item.fact, item.relation, item.entity])
    ].join(" ").toLowerCase();
    return typeMatch && (!state.query || haystack.includes(state.query));
  });

  if (!state.filtered.some((record) => record._id === state.selectedId)) {
    state.selectedId = state.filtered[0]?._id ?? null;
  }

  renderOverview();
  renderList();
  renderDetail();
  renderClusters();
}

function renderOverview() {
  const titleCount = new Set(state.records.flatMap((record) => record.context.map((item) => item.title))).size;
  const edgeCount = state.records.reduce((sum, record) => sum + record.evidences.length, 0);
  els.docCount.textContent = state.records.length + titleCount;
  els.edgeCount.textContent = edgeCount;
  els.clusterCount.textContent = buildClusters(state.filtered).length;
  els.resultCount.textContent = `${state.filtered.length} 条`;
}

function renderList() {
  els.questionList.innerHTML = "";

  if (!state.filtered.length) {
    els.questionList.innerHTML = '<p class="empty">没有匹配结果</p>';
    return;
  }

  for (const record of state.filtered) {
    const button = document.createElement("button");
    button.className = `question-card${record._id === state.selectedId ? " active" : ""}`;
    button.innerHTML = `
      <strong>${escapeHtml(record.question)}</strong>
      <span class="meta">
        <span class="tag">${escapeHtml(record.type)}</span>
        <span class="tag">${record.evidences.length} hop</span>
        <span class="tag">${escapeHtml(record.answer)}</span>
      </span>
    `;
    button.addEventListener("click", () => {
      state.selectedId = record._id;
      render();
    });
    els.questionList.appendChild(button);
  }
}

function renderDetail() {
  const record = state.records.find((item) => item._id === state.selectedId);

  if (!record) {
    els.detailTitle.textContent = "多跳过程";
    els.detailType.textContent = "";
    els.detailQuestion.textContent = "没有可展示的记录。";
    els.detailAnswer.textContent = "";
    els.hopList.innerHTML = "";
    els.aqlCode.textContent = "";
    drawGraph(null);
    return;
  }

  els.detailTitle.textContent = `问题 ${record._id}`;
  els.detailType.textContent = record.type;
  els.detailQuestion.textContent = record.question;
  els.detailAnswer.textContent = record.answer;

  els.hopList.innerHTML = "";
  record.evidences.forEach((edge, index) => {
    const fact = findSupportingText(record, edge.fact);
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="hop-title">第 ${index + 1} 跳：${escapeHtml(edge.fact)} <span>${escapeHtml(edge.relation)}</span></div>
      <div>${escapeHtml(edge.fact)} -> ${escapeHtml(edge.entity)}</div>
      <p>${escapeHtml(fact)}</p>
    `;
    els.hopList.appendChild(li);
  });

  els.aqlCode.textContent = buildAql(record);
  drawGraph(record);
}

function renderClusters() {
  const clusters = buildClusters(state.filtered);
  const max = Math.max(1, ...clusters.map((item) => item.records.length));
  els.clusterList.innerHTML = "";

  for (const cluster of clusters) {
    const item = document.createElement("article");
    item.className = "cluster-item";
    const examples = cluster.records.slice(0, 3).map((record) => record.answer).join("、");
    item.innerHTML = `
      <div class="cluster-top">
        <span>${escapeHtml(cluster.name)}</span>
        <span>${cluster.records.length}</span>
      </div>
      <div class="bar"><span style="width: ${(cluster.records.length / max) * 100}%"></span></div>
      <p>${escapeHtml(examples || "暂无样例")}</p>
    `;
    els.clusterList.appendChild(item);
  }
}

function buildClusters(records) {
  // 课程作业里这里只做轻量聚类：把每条问题的核心关系词作为分桶特征。
  const buckets = new Map();
  for (const record of records) {
    const key = record.evidences[0]?.relation ?? "unknown";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(record);
  }
  return [...buckets.entries()]
    .map(([name, grouped]) => ({ name, records: grouped }))
    .sort((a, b) => b.records.length - a.records.length || a.name.localeCompare(b.name));
}

function findSupportingText(record, title) {
  const context = record.context.find((item) => item.title === title);
  if (!context) return "该实体来自 evidence 字段。";
  const hit = record.supporting_facts.find((item) => item.title === title);
  return context.content[hit?.sent_id ?? 0] ?? context.content[0] ?? "没有句子文本。";
}

function buildAql(record) {
  const start = record.evidences[0]?.fact ?? "";
  const depth = Math.max(1, record.evidences.length);
  return `LET start = DOCUMENT("entities/${slug(start)}")
FOR v, e, p IN 1..${depth} OUTBOUND start evidence_edges
  FILTER p.edges[*].question_id ALL == "${record._id}"
  RETURN {
    question: "${record._id}",
    path: p.vertices[*].name,
    relation: p.edges[*].relation,
    answer: "${record.answer}"
  }`;
}

function drawGraph(record) {
  const canvas = els.graph;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, rect.width, rect.height);

  if (!record) return;

  const nodes = buildGraphNodes(record);
  const edges = record.evidences.map((item) => ({ from: item.fact, to: item.entity, label: item.relation }));
  const width = rect.width;
  const height = rect.height;
  const centerY = height / 2;
  const gap = width / Math.max(2, nodes.length);

  nodes.forEach((node, index) => {
    node.x = Math.min(width - 92, Math.max(92, gap * index + gap / 2));
    node.y = centerY + (index % 2 === 0 ? -58 : 58);
  });

  ctx.lineWidth = 2;
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const edge of edges) {
    const from = nodes.find((node) => node.id === edge.from);
    const to = nodes.find((node) => node.id === edge.to);
    if (!from || !to) continue;

    const start = edgeBoundaryPoint(from, to);
    const end = edgeBoundaryPoint(to, from);
    drawDirectedEdge(ctx, start, end);

    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    const labelX = (start.x + end.x) / 2;
    const labelY = (start.y + end.y) / 2;
    const labelWidth = Math.max(72, ctx.measureText(edge.label).width + 18);
    roundRect(ctx, labelX - labelWidth / 2, labelY - 14, labelWidth, 28, 7, true, false);
    ctx.fillStyle = "#b0445d";
    ctx.fillText(edge.label, labelX, labelY);
  }

  for (const node of nodes) {
    ctx.fillStyle = node.answer ? "#2d7d4f" : node.source ? "#17324d" : "#167a7f";
    roundRect(ctx, node.x - 74, node.y - 22, 148, 44, 8, true, false);
    ctx.fillStyle = "#ffffff";
    wrapCanvasText(ctx, node.id, node.x, node.y, 132, 14);
  }
}

function edgeBoundaryPoint(node, toward) {
  const halfWidth = 74;
  const halfHeight = 22;
  const dx = toward.x - node.x;
  const dy = toward.y - node.y;
  const scale = Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight, 1);
  return {
    x: node.x + dx / scale,
    y: node.y + dy / scale
  };
}

function drawDirectedEdge(ctx, start, end) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const arrowLength = 14;
  const arrowAngle = Math.PI / 7;

  ctx.strokeStyle = "#7f91a8";
  ctx.fillStyle = "#7f91a8";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - arrowLength * Math.cos(angle - arrowAngle), end.y - arrowLength * Math.sin(angle - arrowAngle));
  ctx.lineTo(end.x - arrowLength * Math.cos(angle + arrowAngle), end.y - arrowLength * Math.sin(angle + arrowAngle));
  ctx.closePath();
  ctx.fill();
}

function buildGraphNodes(record) {
  const seen = new Map();
  for (const edge of record.evidences) {
    if (!seen.has(edge.fact)) seen.set(edge.fact, { id: edge.fact, source: true, answer: edge.fact === record.answer });
    if (!seen.has(edge.entity)) seen.set(edge.entity, { id: edge.entity, source: false, answer: edge.entity === record.answer });
  }
  return [...seen.values()];
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.slice(0, 2).forEach((item, index) => ctx.fillText(item, x, startY + index * lineHeight));
}

function slug(value) {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80);
  return cleaned || `entity_${simpleHash(value)}`;
}

function simpleHash(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.addEventListener("resize", () => {
  const record = state.records.find((item) => item._id === state.selectedId);
  drawGraph(record);
});

boot();
