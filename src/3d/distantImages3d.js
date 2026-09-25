(() => {
  const Game = window.CubDep;
  const LIMIT = 32;
  const BYTE_LIMIT = 64 * 1024 * 1024;
  const INTERVAL_MS = 200;

  // Retain the public API name for compatibility. The cache now stores the
  // textured outer surface, not camera-facing pictures or voxel data.
  function create(scene) {
    const surfaces = new Map();
    const size = Game.constants3d.CHUNK_SIZE;
    let world = null;
    let dimension = null;
    let lastBuild = -Infinity;
    let bytes = 0;

    function dispose(surface) {
      scene.remove(surface.group);
      for (const mesh of surface.group.children) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }

    function remove(key) {
      const surface = surfaces.get(key);
      if (!surface) return;
      bytes -= surface.bytes;
      dispose(surface);
      surfaces.delete(key);
    }

    function clear() {
      for (const key of surfaces.keys()) remove(key);
      lastBuild = -Infinity;
    }

    function invalidate(cx, cz) {
      const surface = surfaces.get(`${cx},${cz}`);
      // Keep the old surface until a complete replacement can be installed.
      if (surface) surface.stale = true;
    }

    function build(column) {
      const batches = new Map();
      const point = new THREE.Vector3();
      for (const source of column.meshes) {
        const geometry = source.geometry;
        const position = geometry.getAttribute('position');
        if (!position || !position.count) continue;
        // Terrain meshes use a single material and world-space geometry.
        let batch = batches.get(source.material);
        if (!batch) {
          batch = { positions: [], uvs: [], colors: [], indices: [] };
          batches.set(source.material, batch);
        }
        source.updateMatrixWorld(true);
        const offset = batch.positions.length / 3;
        const uv = geometry.getAttribute('uv');
        const color = geometry.getAttribute('color');
        for (let i = 0; i < position.count; i++) {
          point.fromBufferAttribute(position, i).applyMatrix4(source.matrixWorld);
          batch.positions.push(point.x, point.y, point.z);
          batch.uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
          batch.colors.push(color ? color.getX(i) : 1, color ? color.getY(i) : 1, color ? color.getZ(i) : 1);
        }
        if (geometry.index) {
          for (let i = 0; i < geometry.index.count; i++) batch.indices.push(offset + geometry.index.getX(i));
        } else {
          for (let i = 0; i < position.count; i++) batch.indices.push(offset + i);
        }
      }
      const group = new THREE.Group();
      let totalBytes = 0;
      for (const [original, batch] of batches) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(batch.positions, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(batch.uvs, 2));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(batch.colors, 3));
        geometry.setIndex(batch.indices);
        geometry.computeBoundingSphere();
        totalBytes += geometry.index.array.byteLength;
        for (const attribute of Object.values(geometry.attributes)) totalBytes += attribute.array.byteLength;
        const material = new THREE.MeshBasicMaterial({
          map: original.map, color: original.color, vertexColors: true,
          side: original.side, transparent: original.transparent,
          opacity: original.opacity, alphaTest: original.alphaTest,
          depthWrite: original.depthWrite, fog: true,
        });
        group.add(new THREE.Mesh(geometry, material));
      }
      return { cx: column.cx, cz: column.cz, group, bytes: totalBytes, stale: false, sourceKeys: column.chunkKeys || [] };
    }

    function canRefresh(state, cx, cz) {
      const surface = surfaces.get(`${cx},${cz}`);
      return !surface || surface.sourceKeys.every(key => state.world.chunks && state.world.chunks.has(key));
    }

    function update(state, renderer, camera, columns, now) {
      const nextDimension = state.world.dimension || state.dimension || 'overworld';
      if (world !== state.world || dimension !== nextDimension) {
        clear();
        world = state.world;
        dimension = nextDimension;
      }
      const pcx = Math.floor(state.player.x / size);
      const pcz = Math.floor(state.player.z / size);
      const distance = column => (column.cx - pcx) ** 2 + (column.cz - pcz) ** 2;
      let changed = false;
      if (now - lastBuild >= INTERVAL_MS) {
        const candidates = columns.filter(column => {
          const surface = surfaces.get(`${column.cx},${column.cz}`);
          return column.ready && (!surface || surface.stale) && canRefresh(state, column.cx, column.cz);
        }).sort((a, b) => distance(a) - distance(b));
        if (candidates.length) {
          lastBuild = now;
          const column = candidates[0];
          const key = `${column.cx},${column.cz}`;
          const next = build(column);
          const previousBytes = surfaces.has(key) ? surfaces.get(key).bytes : 0;
          const victims = Array.from(surfaces.entries())
            .filter(([candidateKey, item]) => candidateKey !== key && distance(item) > 4)
            .sort((a, b) => distance(b[1]) - distance(a[1]));
          while ((surfaces.size + Number(!surfaces.has(key)) > LIMIT || bytes - previousBytes + next.bytes > BYTE_LIMIT) && victims.length) {
            remove(victims.shift()[0]);
          }
          if (surfaces.size + Number(!surfaces.has(key)) <= LIMIT && bytes - previousBytes + next.bytes <= BYTE_LIMIT) {
            remove(key);
            surfaces.set(key, next);
            bytes += next.bytes;
            scene.add(next.group);
            changed = true;
          } else dispose(next); // Keep live geometry when a replacement cannot fit.
        }
      }
      const ready = new Set(columns.filter(column => column.ready && canRefresh(state, column.cx, column.cz)).map(column => `${column.cx},${column.cz}`));
      for (const [key, surface] of surfaces) {
        surface.group.visible = !(distance(surface) <= 1 && ready.has(key));
      }
      return changed;
    }

    return {
      update, clear, invalidate, canRefresh,
      hasColumn: (cx, cz) => surfaces.has(`${cx},${cz}`),
      isCurrent: (cx, cz) => { const surface = surfaces.get(`${cx},${cz}`); return !!surface && !surface.stale; },
      size: () => surfaces.size,
    };
  }

  Game.distantImages3d = { create };
})();
