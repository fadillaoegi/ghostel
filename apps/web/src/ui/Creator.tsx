import {
  COLORS,
  COLOR_IDS,
  COSTUMES,
  DEFAULT_LOOK,
  HATS,
  HEADS,
  NAME_MAX,
  crownUnlocked,
  randomLook,
  validateName,
  type ColorId,
  type Look,
  type Profile,
} from "@ghostel/shared";
import { OrbitControls, Sparkles } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useId, useState, type FormEvent } from "react";
import { saveMe } from "../api";
import { Avatar } from "../three/Avatar";
import { Pumpkin } from "../three/Decor";

const HEAD_LABELS: Record<(typeof HEADS)[number], string> = {
  round: "🙂 Classic",
  pumpkin: "🎃 Pumpkin",
  skull: "💀 Skull",
  cat: "🐱 Black cat",
  vampire: "🧛 Vampire",
  werewolf: "🐺 Werewolf",
  frankenstein: "🔩 Frankenstein",
  zombie: "🧟 Zombie",
  alien: "👽 Alien",
};
const HAT_LABELS: Record<(typeof HATS)[number], string> = {
  none: "✖ None",
  witch: "🧙 Witch",
  top: "🎩 Top hat",
  horns: "😈 Horns",
  pirate: "🏴‍☠️ Pirate",
  batears: "🦇 Bat ears",
  crown: "👑 Golden crown",
};
const COSTUME_LABELS: Record<(typeof COSTUMES)[number], string> = {
  none: "👕 Casual",
  cape: "🦇 Vampire cape",
  sheet: "👻 Ghost sheet",
  mummy: "🧻 Mummy wraps",
  batwings: "🦇 Bat wings",
  skeleton: "🦴 Skeleton",
  wizard: "🔮 Wizard robe",
  tattered: "🩹 Zombie rags",
  fur: "🐾 Werewolf fur",
};
const COLOR_LABELS: Record<ColorId, string> = {
  pumpkin: "Pumpkin",
  slime: "Slime",
  moon: "Moonlight",
  violet: "Violet",
  blood: "Blood",
  midnight: "Midnight",
  teal: "Ectoplasm",
  bone: "Bone",
  rose: "Rose",
  ash: "Ash",
};

function Preview({ look }: { look: Look }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ fov: 35, position: [0, 1.6, 4.6] }} className="creator-canvas">
      <color attach="background" args={["#0b0614"]} />
      <fog attach="fog" args={["#0b0614", 6, 14]} />
      <ambientLight intensity={0.5} color="#7a68a8" />
      <hemisphereLight args={["#8d7bd0", "#1a0f24", 0.6]} />
      <spotLight position={[2.5, 5, 3]} angle={0.5} penumbra={0.6} intensity={60} color="#ffe2b8" />
      <pointLight position={[-2, 1, 1.5]} intensity={6} color="#8b5cf6" distance={6} />
      <group position={[0, -0.75, 0]}>
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.95, 1.05, 0.24, 10]} />
          <meshStandardMaterial color="#3a2a55" flatShading />
        </mesh>
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 0.9, 10]} />
          <meshBasicMaterial color="#ff9a2e" toneMapped={false} />
        </mesh>
        <Avatar look={look} />
        <Pumpkin position={[-1.35, -0.24, 0.3]} scale={0.7} rotationY={0.5} lit />
        <Pumpkin position={[1.4, -0.24, -0.2]} scale={0.5} rotationY={-0.6} />
      </group>
      <Sparkles count={40} scale={[5, 3, 3]} position={[0, 0.6, 0]} size={2.5} speed={0.3} color="#c4b5fd" />
      <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.2} minPolarAngle={1.1} maxPolarAngle={1.6} target={[0, 0.1, 0]} />
    </Canvas>
  );
}

function Choice<T extends string>({
  label,
  options,
  value,
  labels,
  onChange,
  locked,
  lockedHint,
}: {
  label: string;
  options: readonly T[];
  value: T;
  labels: Record<T, string>;
  onChange: (value: T) => void;
  /** Options shown but not selectable yet (rewards). */
  locked?: ReadonlySet<T>;
  lockedHint?: string;
}) {
  const id = useId();
  const [hint, setHint] = useState(false);
  return (
    <fieldset className="field">
      <legend id={id}>{label}</legend>
      <div className="chips" role="radiogroup" aria-labelledby={id}>
        {options.map((option) => {
          const isLocked = locked?.has(option) ?? false;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={value === option}
              aria-disabled={isLocked}
              className={value === option ? "chip chip--on" : isLocked ? "chip chip--locked" : "chip"}
              onClick={() => (isLocked ? setHint(true) : onChange(option))}
            >
              {isLocked ? `🔒 ${labels[option].replace(/^\S+\s/, "")}` : labels[option]}
            </button>
          );
        })}
      </div>
      {hint && lockedHint && <p className="field-hint">{lockedHint}</p>}
    </fieldset>
  );
}

function Swatches({ label, value, onChange }: { label: string; value: ColorId; onChange: (value: ColorId) => void }) {
  const id = useId();
  return (
    <fieldset className="field">
      <legend id={id}>
        {label} <span className="field-hint">{COLOR_LABELS[value]}</span>
      </legend>
      <div className="swatches" role="radiogroup" aria-labelledby={id}>
        {COLOR_IDS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value === color}
            aria-label={COLOR_LABELS[color]}
            title={COLOR_LABELS[color]}
            className={value === color ? "swatch swatch--on" : "swatch"}
            style={{ background: COLORS[color] }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function Creator({
  initial,
  mode,
  onSaved,
  onCancel,
  candies = [],
}: {
  initial: Profile | null;
  mode: "checkin" | "edit";
  /** Found candies; all 12 unlock the crown. */
  candies?: readonly string[];
  onSaved: (profile: Profile) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [look, setLook] = useState<Look>(initial?.look ?? DEFAULT_LOOK);
  const [error, setError] = useState<{ field: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const nameId = useId();
  const set = <K extends keyof Look>(key: K) => (value: Look[K]) => setLook((l) => ({ ...l, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const local = validateName(name);
    if (!local.ok) {
      setError({ field: "name", message: local.message });
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveMe({ name, look });
    setSaving(false);
    if (result.ok) onSaved(result.profile);
    else setError({ field: result.field, message: result.message });
  }

  return (
    <div className={mode === "edit" ? "creator creator--overlay" : "creator"} data-testid="creator">
      <div className="creator-stage">
        <Preview look={look} />
        {mode === "checkin" && (
          <header className="brand">
            <h1>Ghostel</h1>
            <p>Check in. Hang out. Play till dawn.</p>
          </header>
        )}
      </div>
      <form className="panel creator-panel" onSubmit={submit} noValidate>
        <h2>{mode === "checkin" ? "Guest registration" : "Change your costume"}</h2>
        <div className="field">
          <label htmlFor={nameId}>Your name</label>
          <input
            id={nameId}
            name="name"
            autoComplete="nickname"
            placeholder="e.g. Count Snackula"
            value={name}
            maxLength={NAME_MAX + 10}
            aria-invalid={error?.field === "name"}
            aria-describedby={`${nameId}-msg`}
            onChange={(e) => setName(e.target.value)}
          />
          <p id={`${nameId}-msg`} className={error?.field === "name" ? "field-error" : "field-hint"} role={error?.field === "name" ? "alert" : undefined}>
            {error?.field === "name" ? error.message : "2–20 letters, numbers or spaces. You can change it any time."}
          </p>
        </div>
        <Choice label="Head" options={HEADS} value={look.head} labels={HEAD_LABELS} onChange={set("head")} />
        <Choice
          label="Hat"
          options={HATS}
          value={look.hat}
          labels={HAT_LABELS}
          onChange={set("hat")}
          locked={crownUnlocked(candies) ? undefined : new Set(["crown"] as const)}
          lockedHint={`Find all 12 candies hidden on the hotel's four floors to unlock the Golden Crown (${candies.length}/12).`}
        />
        <Choice label="Costume" options={COSTUMES} value={look.costume} labels={COSTUME_LABELS} onChange={set("costume")} />
        <Swatches label="Body colour" value={look.body} onChange={set("body")} />
        <Swatches label="Accent colour" value={look.accent} onChange={set("accent")} />
        {error && error.field !== "name" && (
          <p className="field-error" role="alert">
            {error.message}
          </p>
        )}
        <div className="actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              // Surprise me never picks a reward the guest has not earned.
              const next = randomLook();
              setLook(next.hat === "crown" && !crownUnlocked(candies) ? { ...next, hat: "witch" } : next);
            }}
          >
            🎲 Surprise me
          </button>
          {onCancel && (
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? "Saving…" : mode === "checkin" ? "Check in 🗝️" : "Save costume"}
          </button>
        </div>
      </form>
    </div>
  );
}
