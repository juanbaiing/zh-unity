// ⚠️ 这是第三方库 libavoided-js@0.1.2 的打包产物，被 _做libavoid.js 转成了 IIFE。
//    不要手改这个文件 —— 要改去改 _做libavoid.js 再重跑。
//
//    为什么用它：线绕框这件事，业内做得好的是 libavoid（Wybrow 2009，
//    "Orthogonal Connector Routing"）。它的三件套是
//      ① 正交可见性图  ② A* 搜最短路  ③ 通道分离（平行线不糊在一起）
//    关键参数就是「好不好看」本身：
//      bendPenalty 50        拐一次弯罚 50（拐弯是可读性的第二位，Purchase 1997）
//      crossingPenalty 200   跟别的线交叉罚 200
//      edgeSpacing 8         平行线之间的间距
//      obstacleMargin 10     离框的余量
//    我自己写的那版只有「上/下/左/右四种兜法」，出来是楼梯状，所以丑。
(function(){
// src/types.ts
var DEFAULT_OPTIONS = {
  routingStyle: "orthogonal",
  obstacleMargin: 10,
  edgeSpacing: 8,
  bendPenalty: 50,
  crossingPenalty: 200,
  lengthPenalty: 1
};

// src/geometry.ts
var EPSILON = 1e-9;
function pointEquals(a, b) {
  return Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) < EPSILON;
}
function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
function expandRect(rect, margin) {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + 2 * margin,
    height: rect.height + 2 * margin
  };
}
function pointInRect(p, rect) {
  return p.x > rect.x + EPSILON && p.x < rect.x + rect.width - EPSILON && p.y > rect.y + EPSILON && p.y < rect.y + rect.height - EPSILON;
}
function segmentIntersectsRect(seg, rect) {
  const { p1, p2 } = seg;
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  const rLeft = rect.x;
  const rRight = rect.x + rect.width;
  const rTop = rect.y;
  const rBottom = rect.y + rect.height;
  if (Math.abs(p1.y - p2.y) < EPSILON) {
    const y = p1.y;
    if (y <= rTop + EPSILON || y >= rBottom - EPSILON) return false;
    if (maxX <= rLeft + EPSILON || minX >= rRight - EPSILON) return false;
    return true;
  }
  if (Math.abs(p1.x - p2.x) < EPSILON) {
    const x = p1.x;
    if (x <= rLeft + EPSILON || x >= rRight - EPSILON) return false;
    if (maxY <= rTop + EPSILON || minY >= rBottom - EPSILON) return false;
    return true;
  }
  if (maxX <= rLeft + EPSILON || minX >= rRight - EPSILON) return false;
  if (maxY <= rTop + EPSILON || minY >= rBottom - EPSILON) return false;
  return true;
}
function orthogonalSegmentsCross(a, b) {
  const aHoriz = Math.abs(a.p1.y - a.p2.y) < EPSILON;
  const bHoriz = Math.abs(b.p1.y - b.p2.y) < EPSILON;
  if (aHoriz === bHoriz) return false;
  const horiz = aHoriz ? a : b;
  const vert = aHoriz ? b : a;
  const hY = horiz.p1.y;
  const hMinX = Math.min(horiz.p1.x, horiz.p2.x);
  const hMaxX = Math.max(horiz.p1.x, horiz.p2.x);
  const vX = vert.p1.x;
  const vMinY = Math.min(vert.p1.y, vert.p2.y);
  const vMaxY = Math.max(vert.p1.y, vert.p2.y);
  return vX > hMinX + EPSILON && vX < hMaxX - EPSILON && hY > vMinY + EPSILON && hY < vMaxY - EPSILON;
}
function pointKey(p) {
  return `${p.x},${p.y}`;
}
function parsePointKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}
function areCollinear(a, b, c) {
  const sameX = Math.abs(a.x - b.x) < EPSILON && Math.abs(b.x - c.x) < EPSILON;
  const sameY = Math.abs(a.y - b.y) < EPSILON && Math.abs(b.y - c.y) < EPSILON;
  return sameX || sameY;
}

// src/grid.ts
function buildGrid(obstacles, edges, obstacleMargin) {
  const expandedObstacles = obstacles.map((o) => expandRect(o, obstacleMargin));
  const anchorKeys = /* @__PURE__ */ new Set();
  for (const edge of edges) {
    anchorKeys.add(pointKey(edge.sourcePoint));
    anchorKeys.add(pointKey(edge.targetPoint));
  }
  const xCoords = /* @__PURE__ */ new Set();
  const yCoords = /* @__PURE__ */ new Set();
  for (const rect of expandedObstacles) {
    xCoords.add(rect.x);
    xCoords.add(rect.x + rect.width);
    yCoords.add(rect.y);
    yCoords.add(rect.y + rect.height);
  }
  for (const edge of edges) {
    xCoords.add(edge.sourcePoint.x);
    xCoords.add(edge.targetPoint.x);
    yCoords.add(edge.sourcePoint.y);
    yCoords.add(edge.targetPoint.y);
    if (edge.previousPath) {
      for (const p of edge.previousPath) {
        xCoords.add(p.x);
        yCoords.add(p.y);
      }
    }
  }
  const sortedX = [...xCoords].sort((a, b) => a - b);
  const sortedY = [...yCoords].sort((a, b) => a - b);
  for (let i = 0; i < sortedX.length - 1; i++) {
    const mid = (sortedX[i] + sortedX[i + 1]) / 2;
    xCoords.add(mid);
  }
  for (let i = 0; i < sortedY.length - 1; i++) {
    const mid = (sortedY[i] + sortedY[i + 1]) / 2;
    yCoords.add(mid);
  }
  const vertices = /* @__PURE__ */ new Map();
  const finalX = [...xCoords].sort((a, b) => a - b);
  const finalY = [...yCoords].sort((a, b) => a - b);
  for (const x of finalX) {
    for (const y of finalY) {
      const p = { x, y };
      const key = pointKey(p);
      const isAnchor = anchorKeys.has(key);
      if (!isAnchor && isInsideAnyObstacle(p, expandedObstacles)) continue;
      vertices.set(key, { point: p, neighbors: /* @__PURE__ */ new Map() });
    }
  }
  for (const y of finalY) {
    const xsAtY = finalX.filter((x) => vertices.has(pointKey({ x, y })));
    for (let i = 0; i < xsAtY.length - 1; i++) {
      const p1 = { x: xsAtY[i], y };
      const p2 = { x: xsAtY[i + 1], y };
      const seg = { p1, p2 };
      if (!segmentPassesThroughObstacle(seg, expandedObstacles)) {
        const k1 = pointKey(p1);
        const k2 = pointKey(p2);
        const dist = Math.abs(p2.x - p1.x);
        vertices.get(k1).neighbors.set(k2, dist);
        vertices.get(k2).neighbors.set(k1, dist);
      }
    }
  }
  for (const x of finalX) {
    const ysAtX = finalY.filter((y) => vertices.has(pointKey({ x, y })));
    for (let i = 0; i < ysAtX.length - 1; i++) {
      const p1 = { x, y: ysAtX[i] };
      const p2 = { x, y: ysAtX[i + 1] };
      const seg = { p1, p2 };
      if (!segmentPassesThroughObstacle(seg, expandedObstacles)) {
        const k1 = pointKey(p1);
        const k2 = pointKey(p2);
        const dist = Math.abs(p2.y - p1.y);
        vertices.get(k1).neighbors.set(k2, dist);
        vertices.get(k2).neighbors.set(k1, dist);
      }
    }
  }
  return { vertices, expandedObstacles, rawObstacles: obstacles };
}
function isInsideAnyObstacle(p, obstacles) {
  return obstacles.some((o) => pointInRect(p, o));
}
function segmentPassesThroughObstacle(seg, obstacles) {
  return obstacles.some((o) => segmentIntersectsRect(seg, o));
}
function ensurePointInGrid(grid, point) {
  const key = pointKey(point);
  if (!grid.vertices.has(key)) {
    const vertex2 = { point, neighbors: /* @__PURE__ */ new Map() };
    grid.vertices.set(key, vertex2);
  }
  const vertex = grid.vertices.get(key);
  connectAnchorToGrid(grid, key, point, vertex);
}
function connectAnchorToGrid(grid, key, point, vertex) {
  const sameXVertices = [];
  const sameYVertices = [];
  for (const [nKey, nVertex] of grid.vertices) {
    if (nKey === key) continue;
    const np = nVertex.point;
    if (Math.abs(np.x - point.x) < 1e-9) {
      sameXVertices.push({ key: nKey, vertex: nVertex, dist: Math.abs(np.y - point.y) });
    } else if (Math.abs(np.y - point.y) < 1e-9) {
      sameYVertices.push({ key: nKey, vertex: nVertex, dist: Math.abs(np.x - point.x) });
    }
  }
  sameXVertices.sort((a, b) => a.dist - b.dist);
  sameYVertices.sort((a, b) => a.dist - b.dist);
  const above = sameXVertices.find((v) => v.vertex.point.y < point.y && !hasVertexBetween(grid, point, v.vertex.point, "vertical") && !segmentThroughRawObstacle(point, v.vertex.point, grid.rawObstacles));
  const below = sameXVertices.find((v) => v.vertex.point.y > point.y && !hasVertexBetween(grid, point, v.vertex.point, "vertical") && !segmentThroughRawObstacle(point, v.vertex.point, grid.rawObstacles));
  const left = sameYVertices.find((v) => v.vertex.point.x < point.x && !hasVertexBetween(grid, point, v.vertex.point, "horizontal") && !segmentThroughRawObstacle(point, v.vertex.point, grid.rawObstacles));
  const right = sameYVertices.find((v) => v.vertex.point.x > point.x && !hasVertexBetween(grid, point, v.vertex.point, "horizontal") && !segmentThroughRawObstacle(point, v.vertex.point, grid.rawObstacles));
  for (const neighbor of [above, below, left, right]) {
    if (neighbor) {
      vertex.neighbors.set(neighbor.key, neighbor.dist);
      neighbor.vertex.neighbors.set(key, neighbor.dist);
    }
  }
}
function segmentThroughRawObstacle(a, b, obstacles) {
  const seg = { p1: a, p2: b };
  return obstacles.some((o) => segmentIntersectsRect(seg, o));
}
function hasVertexBetween(grid, a, b, direction) {
  for (const [, v] of grid.vertices) {
    const p = v.point;
    if (Math.abs(p.x - a.x) < 1e-9 && Math.abs(p.y - a.y) < 1e-9 || Math.abs(p.x - b.x) < 1e-9 && Math.abs(p.y - b.y) < 1e-9) continue;
    if (direction === "horizontal") {
      if (Math.abs(p.y - a.y) < 1e-9) {
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        if (p.x > minX + 1e-9 && p.x < maxX - 1e-9) return true;
      }
    } else {
      if (Math.abs(p.x - a.x) < 1e-9) {
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);
        if (p.y > minY + 1e-9 && p.y < maxY - 1e-9) return true;
      }
    }
  }
  return false;
}

// src/priority-queue.ts
var PriorityQueue = class {
  heap = [];
  get size() {
    return this.heap.length;
  }
  isEmpty() {
    return this.heap.length === 0;
  }
  push(item, priority) {
    this.heap.push({ item, priority });
    this.bubbleUp(this.heap.length - 1);
  }
  pop() {
    if (this.heap.length === 0) return void 0;
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top.item;
  }
  peek() {
    return this.heap.length > 0 ? this.heap[0].item : void 0;
  }
  peekPriority() {
    return this.heap.length > 0 ? this.heap[0].priority : void 0;
  }
  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = index - 1 >> 1;
      if (this.heap[parentIndex].priority <= this.heap[index].priority) break;
      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }
  sinkDown(index) {
    const length = this.heap.length;
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;
      if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === index) break;
      this.swap(index, smallest);
      index = smallest;
    }
  }
  swap(a, b) {
    [this.heap[a], this.heap[b]] = [this.heap[b], this.heap[a]];
  }
};

// src/pathfinder.ts
function stateKey(posKey, dir) {
  return `${posKey}|${dir}`;
}
function getDirection(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  if (Math.abs(dy) > Math.abs(dx)) {
    return dy > 0 ? "down" : "up";
  }
  return "none";
}
function isBend(d1, d2) {
  if (d1 === "none" || d2 === "none") return false;
  return d1 !== d2;
}
var RoutedSegments = class {
  segments = [];
  addPath(path) {
    for (let i = 0; i < path.length - 1; i++) {
      this.segments.push({ p1: path[i], p2: path[i + 1] });
    }
  }
  countCrossings(seg) {
    let count = 0;
    for (const existing of this.segments) {
      if (orthogonalSegmentsCross(seg, existing)) count++;
    }
    return count;
  }
};
function findPath(grid, source, target, options, routedSegments) {
  const sourceKey = pointKey(source);
  const targetKey = pointKey(target);
  if (!grid.vertices.has(sourceKey) || !grid.vertices.has(targetKey)) {
    return null;
  }
  if (sourceKey === targetKey) {
    return [source];
  }
  const pq = new PriorityQueue();
  const gScore = /* @__PURE__ */ new Map();
  const cameFrom = /* @__PURE__ */ new Map();
  const startDir = options.sourceDirection ?? "none";
  const startState = stateKey(sourceKey, startDir);
  gScore.set(startState, 0);
  pq.push({ key: sourceKey, direction: startDir }, manhattanDistance(source, target) * options.lengthPenalty);
  while (!pq.isEmpty()) {
    const current = pq.pop();
    const currentStateKey = stateKey(current.key, current.direction);
    const currentG = gScore.get(currentStateKey);
    if (current.key === targetKey) {
      if (!options.targetDirection || current.direction === options.targetDirection) {
        return reconstructPath(cameFrom, current.key, current.direction, sourceKey);
      }
      continue;
    }
    const vertex = grid.vertices.get(current.key);
    if (!vertex) continue;
    const currentPoint = vertex.point;
    for (const [neighborKey, edgeDist] of vertex.neighbors) {
      const neighborVertex = grid.vertices.get(neighborKey);
      if (!neighborVertex) continue;
      const neighborPoint = neighborVertex.point;
      const moveDir = getDirection(currentPoint, neighborPoint);
      if (options.sourceDirection && current.key === sourceKey && moveDir !== options.sourceDirection) {
        continue;
      }
      let cost = currentG + edgeDist * options.lengthPenalty;
      if (isBend(current.direction, moveDir)) {
        cost += options.bendPenalty;
      }
      if (routedSegments) {
        const seg = { p1: currentPoint, p2: neighborPoint };
        const crossings = routedSegments.countCrossings(seg);
        cost += crossings * options.crossingPenalty;
      }
      const neighborStateKey = stateKey(neighborKey, moveDir);
      const existingG = gScore.get(neighborStateKey);
      if (existingG === void 0 || cost < existingG) {
        gScore.set(neighborStateKey, cost);
        cameFrom.set(neighborStateKey, { posKey: current.key, dir: current.direction });
        const h = manhattanDistance(neighborPoint, target) * options.lengthPenalty;
        pq.push({ key: neighborKey, direction: moveDir }, cost + h);
      }
    }
  }
  return null;
}
function reconstructPath(cameFrom, endKey, endDir, startKey) {
  const path = [];
  let currentSK = stateKey(endKey, endDir);
  let currentPosKey = endKey;
  while (currentPosKey !== startKey || path.length === 0) {
    path.push(parsePointKey(currentPosKey));
    const prev = cameFrom.get(currentSK);
    if (!prev) break;
    currentSK = stateKey(prev.posKey, prev.dir);
    currentPosKey = prev.posKey;
  }
  if (path.length === 0 || pointKey(path[path.length - 1]) !== startKey) {
    path.push(parsePointKey(startKey));
  }
  path.reverse();
  return path;
}

// src/simplify.ts
function mergeCollinear(path) {
  if (path.length <= 2) return [...path];
  const result = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    if (!areCollinear(result[result.length - 1], path[i], path[i + 1])) {
      result.push(path[i]);
    }
  }
  result.push(path[path.length - 1]);
  return result;
}
function spaceParallelSegments(paths, edgeSpacing) {
  const result = paths.map((p) => p.map((pt) => ({ ...pt })));
  const groups = /* @__PURE__ */ new Map();
  for (let eIdx = 0; eIdx < result.length; eIdx++) {
    const path = result[eIdx];
    for (let sIdx = 0; sIdx < path.length - 1; sIdx++) {
      const p1 = path[sIdx];
      const p2 = path[sIdx + 1];
      const isHoriz = Math.abs(p1.y - p2.y) < 1e-9;
      const isVert = Math.abs(p1.x - p2.x) < 1e-9;
      if (!isHoriz && !isVert) continue;
      const orientation = isHoriz ? "horizontal" : "vertical";
      const coord = isHoriz ? p1.y : p1.x;
      const key = `${orientation}:${coord}`;
      if (!groups.has(key)) {
        groups.set(key, { orientation, coordinate: coord, segments: [] });
      }
      const min = isHoriz ? Math.min(p1.x, p2.x) : Math.min(p1.y, p2.y);
      const max = isHoriz ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y);
      groups.get(key).segments.push({ edgeIndex: eIdx, segIndex: sIdx, min, max });
    }
  }
  for (const [, group] of groups) {
    const byEdge = /* @__PURE__ */ new Map();
    for (const seg of group.segments) {
      if (!byEdge.has(seg.edgeIndex)) byEdge.set(seg.edgeIndex, []);
      byEdge.get(seg.edgeIndex).push(seg);
    }
    const multiEdgeSegs = group.segments.filter((seg) => {
      for (const other of group.segments) {
        if (other.edgeIndex === seg.edgeIndex) continue;
        if (other.min < seg.max - 1e-9 && other.max > seg.min + 1e-9) return true;
      }
      return false;
    });
    if (multiEdgeSegs.length <= 1) continue;
    const clusters = findOverlappingClusters(multiEdgeSegs);
    for (const cluster of clusters) {
      if (cluster.length <= 1) continue;
      const edgeSet = /* @__PURE__ */ new Map();
      for (const seg of cluster) {
        if (!edgeSet.has(seg.edgeIndex)) {
          edgeSet.set(seg.edgeIndex, seg);
        }
      }
      const uniqueByEdge = [...edgeSet.values()];
      if (uniqueByEdge.length <= 1) continue;
      const totalSpread = (uniqueByEdge.length - 1) * edgeSpacing;
      const baseCoord = group.coordinate;
      for (let i = 0; i < uniqueByEdge.length; i++) {
        const offset = -totalSpread / 2 + i * edgeSpacing;
        if (Math.abs(offset) < 1e-9) continue;
        const seg = uniqueByEdge[i];
        const path = result[seg.edgeIndex];
        shiftSegment(path, seg.segIndex, group.orientation, offset);
      }
    }
  }
  return result;
}
function shiftSegment(path, segIndex, orientation, offset) {
  if (orientation === "horizontal") {
    path[segIndex].y += offset;
    path[segIndex + 1].y += offset;
  } else {
    path[segIndex].x += offset;
    path[segIndex + 1].x += offset;
  }
}
function findOverlappingClusters(segments) {
  const sorted = [...segments].sort((a, b) => a.min - b.min);
  const clusters = [];
  let current = [sorted[0]];
  let currentMax = sorted[0].max;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min < currentMax - 1e-9) {
      current.push(sorted[i]);
      currentMax = Math.max(currentMax, sorted[i].max);
    } else {
      clusters.push(current);
      current = [sorted[i]];
      currentMax = sorted[i].max;
    }
  }
  clusters.push(current);
  return clusters;
}
function nudgeAwayFromObstacles(paths, obstacles, margin) {
  return paths.map((path) => nudgePath(path, obstacles, margin));
}
function nudgePath(path, obstacles, margin) {
  if (path.length <= 2) return [...path];
  const result = path.map((p) => ({ ...p }));
  for (let i = 0; i < result.length - 1; i++) {
    const p1 = result[i];
    const p2 = result[i + 1];
    const isHoriz = Math.abs(p1.y - p2.y) < 1e-9;
    const isVert = Math.abs(p1.x - p2.x) < 1e-9;
    if (!isHoriz && !isVert) continue;
    const p1IsEndpoint = i === 0;
    const p2IsEndpoint = i + 1 === result.length - 1;
    if (p1IsEndpoint && p2IsEndpoint) continue;
    for (const obs of obstacles) {
      if (isHoriz) {
        const segY = p1.y;
        const segMinX = Math.min(p1.x, p2.x);
        const segMaxX = Math.max(p1.x, p2.x);
        if (segMaxX <= obs.x || segMinX >= obs.x + obs.width) continue;
        const distToTop = segY - obs.y;
        const distToBottom = obs.y + obs.height - segY;
        let shift = 0;
        if (distToTop > 0 && distToTop < margin) {
          shift = -(margin - distToTop);
        } else if (distToBottom > 0 && distToBottom < margin) {
          shift = margin - distToBottom;
        }
        if (Math.abs(shift) > 1e-9) {
          if (!p1IsEndpoint) result[i].y += shift;
          if (!p2IsEndpoint) result[i + 1].y += shift;
        }
      } else {
        const segX = p1.x;
        const segMinY = Math.min(p1.y, p2.y);
        const segMaxY = Math.max(p1.y, p2.y);
        if (segMaxY <= obs.y || segMinY >= obs.y + obs.height) continue;
        const distToLeft = segX - obs.x;
        const distToRight = obs.x + obs.width - segX;
        let shift = 0;
        if (distToLeft > 0 && distToLeft < margin) {
          shift = -(margin - distToLeft);
        } else if (distToRight > 0 && distToRight < margin) {
          shift = margin - distToRight;
        }
        if (Math.abs(shift) > 1e-9) {
          if (!p1IsEndpoint) result[i].x += shift;
          if (!p2IsEndpoint) result[i + 1].x += shift;
        }
      }
    }
  }
  return result;
}
function simplifyPaths(paths, obstacles, edgeSpacing, obstacleMargin) {
  let result = paths.map(mergeCollinear);
  result = spaceParallelSegments(result, edgeSpacing);
  result = nudgeAwayFromObstacles(result, obstacles, obstacleMargin);
  result = result.map(mergeCollinear);
  return result;
}

// src/router.ts
function routeEdges(input, options) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { obstacles, edges } = input;
  if (edges.length === 0) {
    return { edges: [] };
  }
  const pinnedEdges = [];
  const routableEdges = [];
  for (const edge of edges) {
    if (edge.pinnedWaypoints && edge.pinnedWaypoints.length > 0) {
      pinnedEdges.push(edge);
    } else {
      routableEdges.push(edge);
    }
  }
  const sortedEdges = [...routableEdges].sort((a, b) => {
    const distA = manhattanDistance(a.sourcePoint, a.targetPoint);
    const distB = manhattanDistance(b.sourcePoint, b.targetPoint);
    return distA - distB;
  });
  const grid = buildGrid(obstacles, edges, opts.obstacleMargin);
  for (const edge of edges) {
    ensurePointInGrid(grid, edge.sourcePoint);
    ensurePointInGrid(grid, edge.targetPoint);
  }
  const routedSegments = new RoutedSegments();
  const rawPaths = /* @__PURE__ */ new Map();
  for (const edge of pinnedEdges) {
    const path = [edge.sourcePoint, ...edge.pinnedWaypoints, edge.targetPoint];
    rawPaths.set(edge.id, path);
    routedSegments.addPath(path);
  }
  for (const edge of sortedEdges) {
    const path = findPath(
      grid,
      edge.sourcePoint,
      edge.targetPoint,
      {
        bendPenalty: opts.bendPenalty,
        crossingPenalty: opts.crossingPenalty,
        lengthPenalty: opts.lengthPenalty,
        sourceDirection: edge.sourceDirection,
        targetDirection: edge.targetDirection
      },
      routedSegments
    );
    if (path) {
      rawPaths.set(edge.id, path);
      routedSegments.addPath(path);
    } else {
      rawPaths.set(edge.id, [edge.sourcePoint, edge.targetPoint]);
    }
  }
  const pathsInOrder = edges.map((e) => rawPaths.get(e.id) || [e.sourcePoint, e.targetPoint]);
  const pinnedIds = new Set(pinnedEdges.map((e) => e.id));
  const nonPinnedIndices = [];
  const nonPinnedPaths = [];
  for (let i = 0; i < edges.length; i++) {
    if (!pinnedIds.has(edges[i].id)) {
      nonPinnedIndices.push(i);
      nonPinnedPaths.push(pathsInOrder[i]);
    }
  }
  const simplifiedNonPinned = simplifyPaths(
    nonPinnedPaths,
    grid.expandedObstacles,
    opts.edgeSpacing,
    opts.obstacleMargin
  );
  const finalPaths = [...pathsInOrder];
  for (let i = 0; i < nonPinnedIndices.length; i++) {
    finalPaths[nonPinnedIndices[i]] = simplifiedNonPinned[i];
  }
  const routedEdges = edges.map((edge, i) => {
    const path = finalPaths[i];
    return formatEdge(edge, path);
  });
  return { edges: routedEdges };
}
function formatEdge(edge, path) {
  return {
    id: edge.id,
    sections: [
      {
        startPoint: path[0],
        endPoint: path[path.length - 1],
        bendPoints: path.slice(1, -1),
        incomingShape: edge.sourceId,
        outgoingShape: edge.targetId
      }
    ]
  };
}

// src/incremental.ts
function edgeTopologyChanged(edge, previousEdge, currentObstacles, previousObstacles) {
  if (!previousEdge) return true;
  if (!pointEquals(edge.sourcePoint, previousEdge.sourcePoint)) return true;
  if (!pointEquals(edge.targetPoint, previousEdge.targetPoint)) return true;
  if (currentObstacles.length !== previousObstacles.length) return true;
  const currentIds = new Set(currentObstacles.map((o) => o.id));
  const previousIds = new Set(previousObstacles.map((o) => o.id));
  for (const id of currentIds) {
    if (!previousIds.has(id)) return true;
  }
  for (const curr of currentObstacles) {
    const prev = previousObstacles.find((o) => o.id === curr.id);
    if (!prev) return true;
    if (curr.x !== prev.x || curr.y !== prev.y || curr.width !== prev.width || curr.height !== prev.height) {
      return true;
    }
  }
  return false;
}
function routeEdgesIncremental(input, previousInput, previousOutput, options) {
  if (!previousInput || !previousOutput) {
    return routeEdges(input, options);
  }
  const previousEdgeMap = /* @__PURE__ */ new Map();
  for (const edge of previousInput.edges) {
    previousEdgeMap.set(edge.id, edge);
  }
  const previousResultMap = /* @__PURE__ */ new Map();
  for (const routed of previousOutput.edges) {
    if (routed.sections.length > 0) {
      const section = routed.sections[0];
      const path = [section.startPoint, ...section.bendPoints, section.endPoint];
      previousResultMap.set(routed.id, path);
    }
  }
  const changedEdges = [];
  const unchangedEdges = /* @__PURE__ */ new Map();
  for (const edge of input.edges) {
    const prevEdge = previousEdgeMap.get(edge.id);
    const changed = edgeTopologyChanged(
      edge,
      prevEdge,
      input.obstacles,
      previousInput.obstacles
    );
    if (changed) {
      const prevPath = previousResultMap.get(edge.id);
      changedEdges.push({
        ...edge,
        previousPath: prevPath || edge.previousPath
      });
    } else {
      const prevPath = previousResultMap.get(edge.id);
      if (prevPath) {
        unchangedEdges.set(edge.id, prevPath);
      } else {
        changedEdges.push(edge);
      }
    }
  }
  if (changedEdges.length === 0) {
    return buildOutput(input.edges, unchangedEdges);
  }
  const fullInput = {
    obstacles: input.obstacles,
    edges: input.edges.map((e) => {
      const prevPath = previousResultMap.get(e.id);
      return prevPath ? { ...e, previousPath: prevPath } : e;
    })
  };
  return routeEdges(fullInput, options);
}
function buildOutput(edges, pathMap) {
  return {
    edges: edges.map((edge) => {
      const path = pathMap.get(edge.id) || [edge.sourcePoint, edge.targetPoint];
      return {
        id: edge.id,
        sections: [
          {
            startPoint: path[0],
            endPoint: path[path.length - 1],
            bendPoints: path.slice(1, -1),
            incomingShape: edge.sourceId,
            outgoingShape: edge.targetId
          }
        ]
      };
    })
  };
}

  window.libavoided = { DEFAULT_OPTIONS, routeEdges, routeEdgesIncremental };
})();
