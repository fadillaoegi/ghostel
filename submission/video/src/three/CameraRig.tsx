import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import * as THREE from "three";
import type { Vec3 } from "./textPoints";

/**
 * Places the camera for the current frame. Runs in a layout effect, which is before @remotion/three advances
 * (renders) the frame in its own effect, so every frame is drawn from the right spot.
 */
export function CameraRig({ position, target, roll = 0, fov }: { position: Vec3; target: Vec3; roll?: number; fov?: number }) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.lookAt(target[0], target[1], target[2]);
    camera.rotateZ(roll);
    if (fov !== undefined && camera instanceof THREE.PerspectiveCamera && camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}
