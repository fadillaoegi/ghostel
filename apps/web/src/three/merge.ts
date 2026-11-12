import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// M19: static props that repeat (windows, pillars) are merged into one mesh per material, so the
// renderer draws a handful of objects instead of dozens. They must never move or animate.

export interface StaticPart {
  geometry: THREE.BufferGeometry;
  /** Where the part sits in the scene (see `place`). */
  matrix: THREE.Matrix4;
  material: string;
}

type Vec3 = readonly [number, number, number];

/** A transform from position, Euler rotation (radians) and scale. */
export function place(position: Vec3, rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
}

/** `parent × child`: a part placed inside a placed group. */
export function within(parent: THREE.Matrix4, child: THREE.Matrix4): THREE.Matrix4 {
  return new THREE.Matrix4().multiplyMatrices(parent, child);
}

/** One merged geometry per material key. Built once; geometries are disposed when the component unmounts. */
export function useMergedParts(build: () => StaticPart[]): Map<string, THREE.BufferGeometry> {
  const merged = useMemo(() => {
    const byMaterial = new Map<string, THREE.BufferGeometry[]>();
    const sources: THREE.BufferGeometry[] = [];
    for (const part of build()) {
      sources.push(part.geometry);
      // mergeGeometries needs the same attributes everywhere; all our primitives are indexed with position, normal and uv.
      const g = part.geometry.clone().applyMatrix4(part.matrix);
      const list = byMaterial.get(part.material) ?? [];
      list.push(g);
      byMaterial.set(part.material, list);
    }
    const out = new Map<string, THREE.BufferGeometry>();
    for (const [key, list] of byMaterial) {
      const one = mergeGeometries(list, false);
      if (one) out.set(key, one);
      for (const g of list) g.dispose();
    }
    for (const g of new Set(sources)) g.dispose();
    return out;
    // Built once per mount: the parts are static by definition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => merged.forEach((g) => g.dispose()), [merged]);
  return merged;
}
