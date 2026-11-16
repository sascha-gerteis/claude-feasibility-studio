// Seven original illustrated researchers (SVG). Pose is supplied by poseFor(), i.e. by recorded
// hook events: only "typing"/"reviewing" animate continuously, and only while a run is recorded
// as in progress. All motion is disabled under prefers-reduced-motion.
import type { Pose } from "../../../shared/presentation";

type Hair = "short" | "slick" | "bun" | "long" | "beard" | "curly" | "wavy";
interface Look {
  skin: string; hair: string; hairStyle: Hair; jacket: string; shirt: string; accent: string;
  glasses?: boolean; tie?: string; headset?: boolean; necklace?: boolean;
  prop: "team" | "bars" | "gantt" | "stack" | "tower" | "nodes" | "leaf";
  deskItem?: "tablet" | "calculator" | "hardhat" | "briefcase" | "model" | "mug" | "plant";
}

export const LOOKS: Record<string, Look> = {
  "head-of-market-research": { skin: "#e9bf98", hair: "#b9bec6", hairStyle: "short", jacket: "#1d3557", shirt: "#dbe7f5", accent: "#2c5aa0", glasses: true, tie: "#7a8ca8", prop: "team", deskItem: "tablet" },
  "investment-banking": { skin: "#c68a5e", hair: "#2b2320", hairStyle: "slick", jacket: "#3a3f47", shirt: "#f4f6f8", accent: "#b08a2e", tie: "#8c2f39", prop: "bars", deskItem: "calculator" },
  "project-technology": { skin: "#f1c6a0", hair: "#9a4a2a", hairStyle: "bun", jacket: "#1f6f78", shirt: "#eef6f6", accent: "#1f8a96", prop: "gantt", deskItem: "hardhat" },
  syndications: { skin: "#8d5a3b", hair: "#1d1716", hairStyle: "long", jacket: "#5b3a73", shirt: "#f3eef7", accent: "#7a4fa0", necklace: true, prop: "stack", deskItem: "briefcase" },
  "real-estate-hospitality": { skin: "#dfa676", hair: "#5a3b26", hairStyle: "beard", jacket: "#3f6b4f", shirt: "#f2f5ef", accent: "#3c8a5c", glasses: false, prop: "tower", deskItem: "model" },
  "ai-strategy": { skin: "#6b4228", hair: "#1f1612", hairStyle: "curly", jacket: "#c4622d", shirt: "#fbf1ea", accent: "#d97436", headset: true, prop: "nodes", deskItem: "mug" },
  "environmental-technologies": { skin: "#d9a37a", hair: "#c9a25f", hairStyle: "wavy", jacket: "#5f6b3a", shirt: "#f4f6ec", accent: "#5e8a3a", glasses: true, prop: "leaf", deskItem: "plant" },
};

function HairShape({ s, c }: { s: Hair; c: string }) {
  switch (s) {
    case "slick": return <path d="M80 54c0-15 9-23 20-23s20 7 20 21c-4-6-12-10-21-10s-15 4-19 12z" fill={c} />;
    case "bun": return <g fill={c}><circle cx="100" cy="30" r="8" /><path d="M80 57c-1-16 8-25 20-25s21 9 20 25c-3-9-10-14-20-14s-17 5-20 14z" /></g>;
    case "long": return <path d="M78 60c-2-18 8-29 22-29s24 11 22 29l2 30h-10l-2-26c-3-7-7-10-12-11-5 1-9 4-12 11l-2 26h-10z" fill={c} />;
    case "beard": return <g fill={c}><path d="M80 55c0-14 9-22 20-22s20 8 20 22c-4-6-11-9-20-9s-16 3-20 9z" /><path d="M83 66c2 12 9 18 17 18s15-6 17-18c-3 5-9 8-17 8s-14-3-17-8z" /></g>;
    case "curly": return <g fill={c}>{[[84, 44], [92, 36], [102, 33], [112, 37], [118, 46], [80, 54], [120, 55]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" />)}</g>;
    case "wavy": return <path d="M80 56c-2-14 8-24 20-24s22 9 20 24c-3-5-6-7-10-7-3 3-7 4-10 2-3 3-8 3-11 0-4 0-7 2-9 5z" fill={c} />;
    default: return <path d="M80 54c0-14 9-22 20-22s20 8 20 22c-3-7-11-11-20-11s-17 4-20 11z" fill={c} />;
  }
}

function Screen({ prop, accent, on, uid }: { prop: Look["prop"]; accent: string; on: boolean; uid: string }) {
  if (!on) return <rect x="138" y="76" width="44" height="30" rx="2" fill="#1d2430" />;
  const lines = (
    <g className="screen-scroll">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x="142" y={95 + i * 6} width={10 + ((i * 7) % 22)} height="2" rx="1" fill="#c9d5e6" />)}
    </g>
  );
  const icon = {
    team: <g fill={accent}>{[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={146 + (i % 3) * 9} cy={83 + Math.floor(i / 3) * 8} r="2.6" />)}<circle cx="173" cy="87" r="4" /></g>,
    bars: <g fill={accent}><rect x="144" y="86" width="5" height="6" /><rect x="151" y="82" width="5" height="10" /><rect x="158" y="84" width="5" height="8" /><rect x="165" y="79" width="5" height="13" /><rect x="172" y="81" width="5" height="11" /></g>,
    gantt: <g fill={accent}><rect x="143" y="80" width="16" height="3" /><rect x="150" y="85" width="18" height="3" /><rect x="160" y="90" width="17" height="3" /></g>,
    stack: <g fill={accent}><ellipse cx="160" cy="91" rx="10" ry="3" /><ellipse cx="160" cy="87" rx="10" ry="3" opacity=".8" /><ellipse cx="160" cy="83" rx="10" ry="3" opacity=".6" /></g>,
    tower: <g fill={accent}><rect x="150" y="78" width="9" height="15" /><rect x="161" y="83" width="12" height="10" /><rect x="143" y="86" width="6" height="7" /></g>,
    nodes: <g stroke={accent} strokeWidth="1.2" fill={accent}><line x1="146" y1="88" x2="158" y2="80" /><line x1="158" y1="80" x2="172" y2="87" /><line x1="146" y1="88" x2="172" y2="87" /><circle cx="146" cy="88" r="2.4" /><circle cx="158" cy="80" r="2.4" /><circle cx="172" cy="87" r="2.4" /></g>,
    leaf: <g><circle cx="171" cy="82" r="4" fill="#e3b341" /><path d="M146 93c2-10 10-14 18-13-1 8-7 14-18 13z" fill={accent} /></g>,
  }[prop];
  return (
    <g>
      <rect x="138" y="76" width="44" height="30" rx="2" fill="#f7f9fc" stroke="#cfd6df" />
      {icon}
      <clipPath id={`scr-${uid}`}><rect x="140" y="94" width="40" height="11" /></clipPath>
      <g clipPath={`url(#scr-${uid})`}>{lines}</g>
    </g>
  );
}

function DeskItem({ item, accent }: { item?: Look["deskItem"]; accent: string }) {
  switch (item) {
    case "calculator": return <g><rect x="30" y="112" width="16" height="11" rx="1.5" fill="#2e3440" /><rect x="32" y="114" width="12" height="3" fill="#a3d9a5" /></g>;
    case "hardhat": return <g><path d="M24 123c0-9 7-14 14-14s14 5 14 14z" fill="#f2b705" /><rect x="22" y="121" width="32" height="3" rx="1" fill="#d99c00" /></g>;
    case "briefcase": return <g><rect x="24" y="111" width="26" height="13" rx="2" fill="#5b3a2e" /><rect x="33" y="108" width="8" height="4" rx="1" fill="none" stroke="#5b3a2e" strokeWidth="2" /></g>;
    case "model": return <g fill={accent}><rect x="26" y="106" width="8" height="18" /><rect x="35" y="112" width="10" height="12" opacity=".75" /><rect x="46" y="116" width="6" height="8" opacity=".55" /></g>;
    case "mug": return <g><rect x="32" y="112" width="11" height="12" rx="2" fill="#f4f1ec" stroke="#c9c2b8" /><path d="M43 115c4 0 4 6 0 6" stroke="#c9c2b8" fill="none" /></g>;
    case "plant": return <g><path d="M30 124h14l-2-9H32z" fill="#b7744a" /><path d="M37 115c-6-4-8-10-5-14 4 2 6 7 5 14zm0 0c5-5 10-6 13-3-3 4-8 5-13 3z" fill="#4f8a3a" /></g>;
    case "tablet": return <g><rect x="26" y="113" width="22" height="11" rx="1.5" fill="#26303d" /><rect x="28" y="115" width="18" height="7" fill="#9fb8d9" /></g>;
    default: return null;
  }
}

export function Character({ agent, pose, size = 168, title }: { agent: string; pose: Pose; size?: number; title: string }) {
  const L = LOOKS[agent] ?? LOOKS["head-of-market-research"];
  const screenOn = pose !== "idle";
  return (
    <svg viewBox="10 8 186 154" width={size} height={(size * 154) / 186} role="img" aria-label={title}
      className={`office-anim pose-${pose} block max-w-full`}>
      <title>{title}</title>
      <ellipse cx="100" cy="158" rx="78" ry="7" fill="#1b2430" opacity=".07" />
      {/* chair */}
      <rect x="78" y="70" width="44" height="52" rx="10" fill="#2a3442" opacity=".85" />
      <g className="person" style={{ opacity: pose === "idle" ? 0.78 : 1 }}>
        {L.hairStyle === "long" && <path d="M78 60l-2 32h48l-2-32z" fill={L.hair} />}
        {/* torso */}
        <path d="M70 128c0-26 12-40 30-40s30 14 30 40z" fill={L.jacket} />
        <path d="M92 88l8 14 8-14z" fill={L.shirt} />
        {L.tie && <path d="M98 92h4l2 18-4 5-4-5z" fill={L.tie} />}
        {L.necklace && <path d="M91 90q9 9 18 0" stroke="#f4efe6" strokeWidth="2" fill="none" />}
        {/* neck and head */}
        <rect x="95" y="74" width="10" height="12" fill={L.skin} />
        <g className="head">
          <circle cx="100" cy="58" r="19" fill={L.skin} />
          <HairShape s={L.hairStyle} c={L.hair} />
          <g className="eyes" fill="#1b2430">
            <circle cx="93" cy="60" r="1.9" /><circle cx="107" cy="60" r="1.9" />
          </g>
          {L.glasses && <g fill="none" stroke="#2e3440" strokeWidth="1.3"><circle cx="93" cy="60" r="4.6" /><circle cx="107" cy="60" r="4.6" /><line x1="97.6" y1="60" x2="102.4" y2="60" /></g>}
          <path d={pose === "alert" ? "M95 69q5-3 10 0" : pose === "done" ? "M94 67q6 5 12 0" : "M95 68q5 2 10 0"} stroke="#7a4a3a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
          {L.headset && <g fill="none" stroke="#2e3440" strokeWidth="2.2"><path d="M81 58a19 19 0 0 1 38 0" /><rect x="78" y="56" width="5" height="9" rx="2" fill="#2e3440" /><path d="M80 64q2 9 10 9" strokeWidth="1.4" /></g>}
        </g>
        {/* arms: typing pose animates them; reviewing holds a document */}
        {pose === "reviewing" ? (
          <g className="doc">
            <rect x="84" y="94" width="32" height="26" rx="1.5" fill="#ffffff" stroke="#c9d1db" transform="rotate(-4 100 107)" />
            {[0, 1, 2, 3].map((i) => <rect key={i} x="88" y={99 + i * 5} width={22 - (i % 2) * 6} height="1.8" fill="#9aa8bb" transform="rotate(-4 100 107)" />)}
            <ellipse cx="86" cy="116" rx="6" ry="4" fill={L.skin} /><ellipse cx="114" cy="113" rx="6" ry="4" fill={L.skin} />
          </g>
        ) : (
          <g>
            <g className="arm-l"><path d="M74 112c4 6 12 9 20 9" stroke={L.jacket} strokeWidth="9" strokeLinecap="round" fill="none" /><ellipse cx="94" cy="120" rx="5" ry="3.5" fill={L.skin} /></g>
            <g className="arm-r"><path d="M126 112c-4 6-12 9-20 9" stroke={L.jacket} strokeWidth="9" strokeLinecap="round" fill="none" /><ellipse cx="106" cy="120" rx="5" ry="3.5" fill={L.skin} /></g>
          </g>
        )}
      </g>
      {/* desk */}
      <rect x="14" y="123" width="172" height="8" rx="2" fill="#c8ad8a" />
      <rect x="20" y="131" width="160" height="22" rx="2" fill="#b39573" />
      {/* laptop */}
      <path d="M82 122h36l4 2H78z" fill="#9aa4b1" />
      {/* monitor */}
      <rect x="157" y="106" width="6" height="17" fill="#8d97a4" /><rect x="149" y="121" width="22" height="3" rx="1" fill="#8d97a4" />
      <Screen prop={L.prop} accent={L.accent} on={screenOn} uid={`${agent}-${size}`} />
      {pose === "typing" && <rect className="cursor" x="173" y="99" width="2" height="5" fill={L.accent} />}
      <DeskItem item={L.deskItem} accent={L.accent} />
      {/* status badges */}
      {pose === "done" && (
        <g className="badge-done">
          <circle cx="172" cy="30" r="13" fill="#2f8f5b" />
          <path d="M165 30l5 5 9-10" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <g className="sparkles" fill="#e3b341"><circle cx="152" cy="18" r="2" /><circle cx="190" cy="16" r="1.6" /><circle cx="188" cy="46" r="1.8" /></g>
        </g>
      )}
      {pose === "alert" && (
        <g><path d="M172 15l14 25h-28z" fill="#d9822b" /><rect x="170.6" y="23" width="2.8" height="9" fill="#fff" /><circle cx="172" cy="35.5" r="1.6" fill="#fff" /></g>
      )}
      {pose === "waiting" && (
        <g aria-hidden><circle cx="172" cy="28" r="12" fill="#f3e3b8" /><path d="M167 20h10l-5 8 5 8h-10l5-8z" fill="none" stroke="#9a6b12" strokeWidth="1.6" strokeLinejoin="round" /></g>
      )}
    </svg>
  );
}
