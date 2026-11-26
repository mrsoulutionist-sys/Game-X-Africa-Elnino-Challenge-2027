import * as THREE from 'three';

export interface HorizonBackdropHandle {
  group: THREE.Group;
  update: (time: number) => void;
  dispose: () => void;
}

/**
 * Layered outdoor horizon backdrop placed outside courtyard fences so the solid sky
 * is broken up with indigenous trees, shrubs, Table Mountain / Cape silhouettes, and drifting clouds.
 */
export function createHorizonBackdrop(): HorizonBackdropHandle {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x5d442d,
    roughness: 0.9,
    metalness: 0.0,
  });
  const canopyDeepMat = new THREE.MeshStandardMaterial({
    color: 0x2f6b3c,
    roughness: 0.82,
    metalness: 0.0,
  });
  const canopyMidMat = new THREE.MeshStandardMaterial({
    color: 0x418248,
    roughness: 0.8,
    metalness: 0.0,
  });
  const canopyBrightMat = new THREE.MeshStandardMaterial({
    color: 0x5ca156,
    roughness: 0.78,
    metalness: 0.0,
  });
  const shrubMat = new THREE.MeshStandardMaterial({
    color: 0x3b7a42,
    roughness: 0.85,
  });
  const mountainFarMat = new THREE.MeshStandardMaterial({
    color: 0x5a7284,
    roughness: 0.95,
    metalness: 0.0,
  });
  const mountainMidMat = new THREE.MeshStandardMaterial({
    color: 0x4a635e,
    roughness: 0.94,
    metalness: 0.0,
  });
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xf8fbff,
    emissive: 0xe6eff8,
    emissiveIntensity: 0.28,
    roughness: 0.95,
    metalness: 0.0,
    transparent: true,
    opacity: 0.9,
  });

  disposables.push(
    trunkMat,
    canopyDeepMat,
    canopyMidMat,
    canopyBrightMat,
    shrubMat,
    mountainFarMat,
    mountainMidMat,
    cloudMat
  );

  // 1. Distant Table Mountain & Cape Mountain Range Silhouettes (North & Side flanks)
  const addRidgePeak = (
    topR: number,
    botR: number,
    h: number,
    segs: number,
    x: number,
    y: number,
    z: number,
    scaleX: number,
    scaleZ: number,
    mat: THREE.Material
  ) => {
    const geom = new THREE.CylinderGeometry(topR, botR, h, segs);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(scaleX, 1, scaleZ);
    group.add(mesh);
  };

  // Central iconic flat-topped Table Mountain mass
  addRidgePeak(5.8, 8.6, 5.4, 8, -0.4, 2.6, -21.5, 1.45, 0.42, mountainFarMat);
  // Devil's Peak (east shoulder)
  addRidgePeak(0.55, 4.4, 6.1, 7, 8.2, 2.9, -20.2, 1.15, 0.52, mountainFarMat);
  // Lion's Head & Signal Hill (west shoulder)
  addRidgePeak(0.42, 3.7, 5.3, 7, -9.2, 2.5, -19.6, 1.05, 0.5, mountainFarMat);
  // Foothill ridge band
  addRidgePeak(9.5, 12.2, 2.7, 9, 0.8, 1.25, -16.8, 1.5, 0.35, mountainMidMat);
  // Western & Eastern Cape hills breaking side horizons
  addRidgePeak(0.8, 5.4, 4.2, 7, -18.5, 1.9, -8.5, 0.65, 1.4, mountainFarMat);
  addRidgePeak(0.9, 5.8, 4.5, 7, 18.8, 2.0, -7.2, 0.68, 1.5, mountainFarMat);

  // 2. Tall Leafy Indigenous Trees (Acacia & Yellowwood clusters outside perimeter fence)
  const treePositions: Array<[number, number, number, 'acacia' | 'yellowwood']> = [
    [-7.8, -7.2, 1.15, 'acacia'],
    [-3.8, -8.6, 1.28, 'yellowwood'],
    [1.8, -9.1, 1.32, 'acacia'],
    [6.8, -7.8, 1.2, 'yellowwood'],
    [-9.2, -2.5, 1.18, 'yellowwood'],
    [-8.6, 2.8, 1.05, 'acacia'],
    [8.9, -3.2, 1.15, 'acacia'],
    [9.4, 3.4, 1.1, 'yellowwood'],
    [-6.5, 7.6, 1.08, 'acacia'],
    [6.6, 7.9, 1.12, 'yellowwood'],
  ];

  const treeCanopies: Array<{ mesh: THREE.Object3D; baseRotZ: number; phase: number }> = [];

  treePositions.forEach(([tx, tz, scale, kind], idx) => {
    const tree = new THREE.Group();
    tree.position.set(tx, 0, tz);
    tree.scale.setScalar(scale);

    const trunkH = kind === 'acacia' ? 2.4 : 2.8;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.24, trunkH, 8),
      trunkMat
    );
    trunk.position.y = trunkH * 0.5;
    trunk.castShadow = true;
    tree.add(trunk);

    const crownGroup = new THREE.Group();
    crownGroup.position.y = trunkH;

    if (kind === 'acacia') {
      // Wide layered flat-topped African fever-tree / acacia canopy
      const matsArr = [canopyDeepMat, canopyMidMat, canopyBrightMat];
      [
        [0, 0.35, 0, 1.55, 0.48],
        [-0.85, 0.1, 0.35, 1.05, 0.4],
        [0.88, 0.16, -0.3, 1.1, 0.42],
        [0.15, 0.58, 0.18, 1.15, 0.38],
      ].forEach(([cx, cy, cz, rx, ry], cIdx) => {
        const puff = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1, 1),
          matsArr[(idx + cIdx) % matsArr.length]
        );
        puff.scale.set(rx, ry, rx * 0.88);
        puff.position.set(cx, cy, cz);
        puff.castShadow = true;
        crownGroup.add(puff);
      });
    } else {
      // Tall rounded indigenous yellowwood canopy
      [
        [0, 0.7, 0, 1.15, 1.25],
        [-0.65, 0.25, 0.35, 0.88, 0.85],
        [0.62, 0.35, -0.25, 0.92, 0.9],
        [0.1, 1.35, 0.05, 0.82, 0.78],
      ].forEach(([cx, cy, cz, r, ry], cIdx) => {
        const puff = new THREE.Mesh(
          new THREE.DodecahedronGeometry(1, 1),
          cIdx % 2 === 0 ? canopyMidMat : canopyBrightMat
        );
        puff.scale.set(r, ry, r * 0.94);
        puff.position.set(cx, cy, cz);
        puff.castShadow = true;
        crownGroup.add(puff);
      });
    }

    tree.add(crownGroup);
    group.add(tree);
    treeCanopies.push({ mesh: crownGroup, baseRotZ: 0, phase: idx * 0.85 });
  });

  // 3. Green Shrub Clusters Right Behind North, West & East Perimeter Fences
  const shrubCoords: Array<[number, number, number]> = [
    [-4.3, -5.45, 0.65],
    [-2.7, -5.55, 0.82],
    [-1.1, -5.42, 0.72],
    [0.6, -5.52, 0.78],
    [2.3, -5.45, 0.7],
    [3.9, -5.55, 0.85],
    [-5.45, -3.5, 0.72],
    [-5.52, -1.3, 0.84],
    [-5.45, 1.2, 0.7],
    [5.48, -3.4, 0.75],
    [5.54, -0.9, 0.82],
    [5.48, 3.1, 0.68],
  ];
  shrubCoords.forEach(([sx, sz, s], i) => {
    const bush = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.55 * s, 1),
      i % 2 === 0 ? shrubMat : canopyMidMat
    );
    bush.scale.set(1.25, 0.85, 1.15);
    bush.position.set(sx, 0.38 * s, sz);
    group.add(bush);
  });

  // 4. Soft Drifting Clouds Breaking Up the Blue Sky
  const clouds: Array<{ mesh: THREE.Group; baseX: number; speed: number; range: number }> = [];
  const cloudLayouts: Array<[number, number, number, number, number]> = [
    [-10, 9.2, -17.5, 1.25, 0.22],
    [-1.5, 10.4, -19.5, 1.45, 0.16],
    [8.5, 8.8, -16.2, 1.15, 0.26],
    [13.5, 10.1, -9.5, 1.1, 0.19],
    [-13.5, 9.6, -8.5, 1.15, 0.21],
  ];

  cloudLayouts.forEach(([cx, cy, cz, sc, spd], i) => {
    const cg = new THREE.Group();
    cg.position.set(cx, cy, cz);
    cg.scale.setScalar(sc);
    [
      [0, 0, 0, 1.35, 0.68, 0.95],
      [-1.05, -0.14, 0.1, 0.95, 0.56, 0.82],
      [1.08, -0.12, -0.05, 1.0, 0.58, 0.85],
      [0.2, 0.32, 0.05, 0.88, 0.52, 0.75],
    ].forEach(([px, py, pz, sx, sy, sz]) => {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95, 1), cloudMat);
      puff.scale.set(sx, sy, sz);
      puff.position.set(px, py, pz);
      cg.add(puff);
    });
    group.add(cg);
    clouds.push({ mesh: cg, baseX: cx, speed: spd, range: 6 + (i % 3) * 2.5 });
  });

  const update = (time: number) => {
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      c.mesh.position.x = c.baseX + Math.sin(time * 0.06 * c.speed + i * 1.4) * c.range;
      c.mesh.position.y += Math.sin(time * 0.35 + i) * 0.0008;
    }
    for (let i = 0; i < treeCanopies.length; i++) {
      const t = treeCanopies[i];
      t.mesh.rotation.z = t.baseRotZ + Math.sin(time * 0.9 + t.phase) * 0.025;
    }
  };

  const dispose = () => {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
    disposables.forEach((d) => d.dispose());
  };

  return { group, update, dispose };
}
