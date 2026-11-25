import * as THREE from 'three';
import { WEATHER_FORECASTS, type WeatherMode } from './crops';

export interface WeatherFxHandle {
  group: THREE.Group;
  update: (
    dt: number,
    time: number,
    weatherMode: WeatherMode,
    windbreakInstalled: boolean,
    stormBraceInstalled: boolean
  ) => void;
  dispose: () => void;
}

const RAIN_COUNT = 160;
const WIND_COUNT = 44;

/**
 * Software-GL friendly InstancedMesh weather FX (rain squalls, storm patio puddles,
 * and wind-blown leaf/dust particles) with zero per-frame allocations.
 */
export function createWeatherFxSystem(): WeatherFxHandle {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  // Rain streaks InstancedMesh
  const rainGeom = new THREE.BoxGeometry(0.012, 0.34, 0.012);
  const rainMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.68,
  });
  disposables.push(rainGeom, rainMat);
  const rainMesh = new THREE.InstancedMesh(rainGeom, rainMat, RAIN_COUNT);
  rainMesh.frustumCulled = false;
  rainMesh.visible = false;
  group.add(rainMesh);

  const rainX = new Float32Array(RAIN_COUNT);
  const rainY = new Float32Array(RAIN_COUNT);
  const rainZ = new Float32Array(RAIN_COUNT);
  const rainSpeed = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainX[i] = ((i * 73) % 100) / 100 * 9.0 - 4.5;
    rainY[i] = ((i * 37) % 100) / 100 * 5.2 + 0.2;
    rainZ[i] = ((i * 53) % 100) / 100 * 8.8 - 4.5;
    rainSpeed[i] = 7.4 + ((i * 19) % 10) * 0.32;
  }

  // Wind gusts (drifting dry leaves / dust motes)
  const windGeom = new THREE.BoxGeometry(0.085, 0.012, 0.045);
  const windMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.85,
  });
  disposables.push(windGeom, windMat);
  const windMesh = new THREE.InstancedMesh(windGeom, windMat, WIND_COUNT);
  windMesh.frustumCulled = false;
  windMesh.visible = false;
  group.add(windMesh);

  const windX = new Float32Array(WIND_COUNT);
  const windY = new Float32Array(WIND_COUNT);
  const windZ = new Float32Array(WIND_COUNT);
  const windSpeed = new Float32Array(WIND_COUNT);
  for (let i = 0; i < WIND_COUNT; i++) {
    windX[i] = ((i * 61) % 100) / 100 * 9.2 - 4.6;
    windY[i] = 0.25 + (((i * 41) % 100) / 100) * 2.45;
    windZ[i] = ((i * 83) % 100) / 100 * 8.6 - 4.4;
    windSpeed[i] = 2.6 + ((i * 17) % 10) * 0.28;
  }

  // Storm Puddle Rings on courtyard patio (visible in rain_storm)
  const puddleGroup = new THREE.Group();
  const puddleMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const puddleGeom = new THREE.CircleGeometry(0.55, 22);
  disposables.push(puddleMat, puddleGeom);

  const puddleCoords: Array<[number, number, number]> = [
    [-1.65, -2.55, 1.1],
    [1.85, -2.75, 0.9],
    [-2.5, 1.3, 1.2],
    [2.45, 1.45, 0.95],
    [0.05, 1.8, 1.3],
  ];
  const puddleMeshes: THREE.Mesh[] = [];
  puddleCoords.forEach(([px, pz, sc]) => {
    const p = new THREE.Mesh(puddleGeom, puddleMat);
    p.rotation.x = -Math.PI * 0.5;
    p.position.set(px, 0.036, pz);
    p.scale.setScalar(sc);
    puddleGroup.add(p);
    puddleMeshes.push(p);
  });
  puddleGroup.visible = false;
  group.add(puddleGroup);

  // Pre-allocated scratch Object3D for zero heap churn
  const dummy = new THREE.Object3D();

  const update = (
    dt: number,
    time: number,
    weatherMode: WeatherMode,
    windbreakInstalled: boolean,
    _stormBraceInstalled: boolean
  ) => {
    const meta = WEATHER_FORECASTS[weatherMode] ?? WEATHER_FORECASTS.normal;
    const isRain = meta.rainIntensity > 0;
    const showWind =
      weatherMode === 'windy' || weatherMode === 'rain_storm' || weatherMode === 'elnino_watch';

    rainMesh.visible = isRain;
    puddleGroup.visible = isRain;

    if (isRain) {
      const windDrift = windbreakInstalled ? 0.9 : 2.1;
      for (let i = 0; i < RAIN_COUNT; i++) {
        rainY[i] -= rainSpeed[i] * dt;
        rainX[i] += windDrift * dt;
        if (rainY[i] < 0.05) {
          rainY[i] = 4.9 + ((i % 7) * 0.14);
          rainX[i] = ((i * 73) % 100) / 100 * 9.0 - 4.5;
        }
        if (rainX[i] > 4.6) rainX[i] -= 9.2;

        dummy.position.set(rainX[i], rainY[i], rainZ[i]);
        dummy.rotation.set(0, 0, -0.18);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        rainMesh.setMatrixAt(i, dummy.matrix);
      }
      rainMesh.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < puddleMeshes.length; i++) {
        const baseScale = puddleCoords[i][2];
        const ripple = baseScale * (0.94 + Math.sin(time * 4.2 + i * 1.4) * 0.06);
        puddleMeshes[i].scale.set(ripple, ripple, 1);
      }
    }

    windMesh.visible = showWind;
    if (showWind) {
      const speedMult = meta.windSpeedMult * (windbreakInstalled ? 0.45 : 1.0);
      for (let i = 0; i < WIND_COUNT; i++) {
        windX[i] += windSpeed[i] * speedMult * dt;
        if (windX[i] > 4.65) {
          windX[i] = -4.65;
        }
        const bobY = windY[i] + Math.sin(time * 4.5 + i) * 0.14;
        dummy.position.set(windX[i], bobY, windZ[i]);
        dummy.rotation.set(time * 2.5 + i, time * 3.1 + i * 0.7, time * 1.8);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        windMesh.setMatrixAt(i, dummy.matrix);
      }
      windMesh.instanceMatrix.needsUpdate = true;
    }
  };

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
  };

  return { group, update, dispose };
}
