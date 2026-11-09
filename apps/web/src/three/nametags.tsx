import { useFrame } from "@react-three/fiber";
import { useEffect, type RefObject } from "react";
import * as THREE from "three";

/** Height above the feet where the bottom of the name tag sits. */
const TAG_HEIGHT = 2.05;

/**
 * Links 3D anchors (avatar groups) to DOM name tags rendered outside the canvas.
 * Positions are projected once per frame and written straight to `style.transform`.
 */
export class TagRegistry {
  readonly anchors = new Map<string, THREE.Object3D>();
  readonly elements = new Map<string, HTMLElement>();

  element(id: string) {
    return (el: HTMLElement | null) => {
      if (el) this.elements.set(id, el);
      else this.elements.delete(id);
    };
  }
}

export function useTagAnchor(registry: TagRegistry, id: string, ref: RefObject<THREE.Object3D | null>): void {
  useEffect(() => {
    const object = ref.current;
    if (!object) return;
    registry.anchors.set(id, object);
    return () => {
      if (registry.anchors.get(id) === object) registry.anchors.delete(id);
    };
  }, [registry, id, ref]);
}

const v = new THREE.Vector3();
const TOP_SAFE_PX = 64;

/** Mounted last in the scene so it runs after the camera and avatars have moved this frame. */
export function TagProjector({ registry }: { registry: TagRegistry }) {
  // Priority must stay 0: a positive priority would switch R3F to manual rendering.
  useFrame(({ camera, size }) => {
    const placed: { el: HTMLElement; x: number; y: number; w: number; h: number }[] = [];
    for (const [id, el] of registry.elements) {
      const anchor = registry.anchors.get(id);
      if (!anchor) {
        el.style.visibility = "hidden";
        continue;
      }
      anchor.getWorldPosition(v);
      v.y += TAG_HEIGHT;
      v.project(camera);
      const hidden = v.z > 1 || v.z < -1;
      el.style.visibility = hidden ? "hidden" : "visible";
      if (hidden) continue;
      placed.push({
        el,
        x: ((v.x + 1) / 2) * size.width,
        y: ((1 - v.y) / 2) * size.height,
        w: el.offsetWidth,
        h: el.offsetHeight,
      });
    }
    // Tags of guests standing close together would overlap: nudge the farther ones (higher on screen) up.
    placed.sort((a, b) => b.y - a.y);
    for (let i = 0; i < placed.length; i++) {
      const tag = placed[i] as (typeof placed)[number];
      for (let j = 0; j < i; j++) {
        const other = placed[j] as (typeof placed)[number];
        const overlapX = Math.abs(tag.x - other.x) < (tag.w + other.w) / 2 + 4;
        const overlapY = tag.y > other.y - other.h - 4 && tag.y - tag.h < other.y;
        if (overlapX && overlapY) tag.y = other.y - other.h - 4;
      }
      // Keep tags (and their speech bubbles) below the top HUD instead of off-screen.
      tag.y = Math.max(tag.y, tag.h + TOP_SAFE_PX);
      tag.el.style.transform = `translate3d(${tag.x.toFixed(1)}px, ${tag.y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    }
  });
  return null;
}
