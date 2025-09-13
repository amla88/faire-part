import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, Tab, Button, Form } from "react-bootstrap";
import { getAvatar } from "../services/avatarService";
import supabaseService from "../services/supabaseService";
import {
  AvatarAsset,
  AvatarCategories,
  AvatarCategory,
  getPublicUrl,
  listAssets,
} from "../services/AvatarAssetsService";
import { ensureAvatarForPersonne, getChoices, upsertChoices, upsertChoicesRPC } from "../services/AvatarChoiceService";

type Option<T extends string | number = string> = { id: T; label: string; color?: string; emoji?: string };

const skinColors: Option[] = [
  { id: "skin1", label: "Clair", color: "#F1C27D" },
  { id: "skin2", label: "Moyen", color: "#E0AC69" },
  { id: "skin3", label: "Mat", color: "#C68642" },
  { id: "skin4", label: "Foncé", color: "#8D5524" },
];
const hairColors: Option[] = [
  { id: "black", label: "Noir", color: "#1c1c1c" },
  { id: "brown", label: "Brun", color: "#5C4033" },
  { id: "blond", label: "Blond", color: "#D4AF37" },
  { id: "red", label: "Roux", color: "#B55239" },
  { id: "gray", label: "Gris", color: "#9AA0A6" },
];
const eyeColors: Option[] = [
  { id: "brown", label: "Brun", color: "#4E342E" },
  { id: "blue", label: "Bleu", color: "#1565C0" },
  { id: "green", label: "Vert", color: "#2E7D32" },
  { id: "gray", label: "Gris", color: "#607D8B" },
];
const hairStyles: Option[] = [
  { id: "short", label: "Court" },
  { id: "medium", label: "Mi-long" },
  { id: "long", label: "Long" },
  { id: "bald", label: "Chauve" },
];
const faceShapes: Option[] = [
  { id: "oval", label: "Ovale" },
  { id: "round", label: "Rond" },
  { id: "square", label: "Carré" },
];
const noseShapes: Option[] = [
  { id: "small", label: "Petit" },
  { id: "medium", label: "Moyen" },
  { id: "large", label: "Grand" },
];
const mouthShapes: Option[] = [
  { id: "thin", label: "Fine" },
  { id: "normal", label: "Normale" },
  { id: "full", label: "Pulpeuse" },
];
const facialHair: Option[] = [
  { id: "none", label: "Aucune" },
  { id: "mustache", label: "Moustache" },
  { id: "beard", label: "Barbe" },
  { id: "goatee", label: "Boucs" },
];
const accessories: Option[] = [
  { id: "none", label: "Aucun" },
  { id: "glasses", label: "Lunettes" },
  { id: "sunglasses", label: "Lunettes soleil" },
];
const hats: Option[] = [
  { id: "none", label: "Aucun" },
  { id: "cap", label: "Casquette" },
  { id: "beanie", label: "Bonnet" },
  { id: "top", label: "Haut-de-forme" },
];
const tops: Option[] = [
  { id: "tshirt", label: "T-shirt", color: "#4CAF50" },
  { id: "shirt", label: "Chemise", color: "#3F51B5" },
  { id: "hoodie", label: "Hoodie", color: "#546E7A" },
];
const bottoms: Option[] = [
  { id: "jeans", label: "Jean", color: "#1565C0" },
  { id: "chino", label: "Chino", color: "#A1887F" },
  { id: "shorts", label: "Short", color: "#43A047" },
];

type AvatarState = {
  skin: string;
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  faceShape: string;
  noseShape: string;
  mouthShape: string;
  facialHair: string;
  accessory: string;
  hat: string;
  top: string;
  bottom: string;
  // mapping catégorie -> asset id choisi
  assets?: Partial<Record<AvatarCategory, string>>;
};

const defaultState: AvatarState = {
  skin: skinColors[0].id,
  hairColor: hairColors[0].id,
  hairStyle: hairStyles[0].id,
  eyeColor: eyeColors[0].id,
  faceShape: faceShapes[0].id,
  noseShape: noseShapes[1].id,
  mouthShape: mouthShapes[1].id,
  facialHair: facialHair[0].id,
  accessory: accessories[0].id,
  hat: hats[0].id,
  top: tops[0].id,
  bottom: bottoms[0].id,
};

function Tile({ option, selected, onSelect }: { option: Option; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={"tile" + (selected ? " selected" : "")}
      onClick={onSelect}
      title={option.label}
    >
      <div className="tile-preview" style={{ background: option.color }}>
        {option.emoji ? <span>{option.emoji}</span> : null}
      </div>
      <div className="tile-label">{option.label}</div>
    </button>
  );
}

function usePersonneId(): string | null {
  try {
    const id = localStorage.getItem("personne_id");
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

function colorFor(list: Option[], id: string, fallback: string) {
  return list.find((o) => o.id === id)?.color || fallback;
}

const AvatarPreview: React.FC<{ state: AvatarState }> = ({ state }) => {
  const skin = colorFor(skinColors, state.skin, "#E0AC69");
  const hair = colorFor(hairColors, state.hairColor, "#333");
  const eyes = colorFor(eyeColors, state.eyeColor, "#4E342E");
  const topColor = colorFor(tops, state.top, "#3F51B5");
  const bottomColor = colorFor(bottoms, state.bottom, "#1565C0");

  const face = useMemo(() => {
    switch (state.faceShape) {
      case "round":
        return { rx: 42, ry: 46 };
      case "square":
        return { rx: 38, ry: 44 };
      default:
        return { rx: 40, ry: 48 };
    }
  }, [state.faceShape]);

  const hairPath = useMemo(() => {
    if (state.hairStyle === "bald") return "";
    if (state.hairStyle === "long") return "M60,60 C40,20 120,20 100,60 L100,110 L60,110 Z";
    if (state.hairStyle === "medium") return "M60,60 C45,30 115,30 100,60 L100,90 L60,90 Z";
    return "M60,60 C50,40 110,40 100,60 L100,80 L60,80 Z";
  }, [state.hairStyle]);

  const facialHairPath = useMemo(() => {
    switch (state.facialHair) {
      case "mustache":
        return "M75,105 C80,100 90,100 95,105";
      case "beard":
        return "M70,115 C80,130 90,130 100,115";
      case "goatee":
        return "M85,120 L90,130 L95,120";
      default:
        return "";
    }
  }, [state.facialHair]);

  const nosePath = useMemo(() => {
    if (state.noseShape === "small") return "M90,95 L92,105";
    if (state.noseShape === "large") return "M88,95 L90,110";
    return "M89,95 L91,107";
  }, [state.noseShape]);

  const mouthPath = useMemo(() => {
    if (state.mouthShape === "thin") return "M80,120 L100,120";
    if (state.mouthShape === "full") return "M80,120 C90,130 90,130 100,120";
    return "M80,120 C90,125 90,125 100,120";
  }, [state.mouthShape]);

  return (
    <svg viewBox="0 0 160 240" width={240} height={360} style={{ background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 8 }}>
      {/* Haut (torse) */}
      <rect x={40} y={160} width={80} height={50} fill={topColor} rx={8} />
      {/* Bas */}
      <rect x={45} y={210} width={70} height={25} fill={bottomColor} rx={6} />

      {/* Tête */}
      <ellipse cx={80} cy={100} rx={face.rx} ry={face.ry} fill={skin} />

      {/* Cheveux */}
      {hairPath && <path d={hairPath} fill={hair} opacity={0.95} />}

      {/* Yeux */}
      <circle cx={75} cy={100} r={4} fill={eyes} />
      <circle cx={95} cy={100} r={4} fill={eyes} />

      {/* Nez */}
      <path d={nosePath} stroke="#6d4c41" strokeWidth={2} />

      {/* Bouche */}
      <path d={mouthPath} stroke="#6d4c41" strokeWidth={2} fill="none" />

      {/* Pilosité faciale */}
      {facialHairPath && <path d={facialHairPath} stroke={hair} strokeWidth={3} fill="none" />}

      {/* Accessoires */}
      {state.accessory === "glasses" && (
        <g stroke="#212121" strokeWidth={2} fill="none">
          <circle cx={70} cy={100} r={8} />
          <circle cx={100} cy={100} r={8} />
          <line x1={78} y1={100} x2={92} y2={100} />
        </g>
      )}
      {state.accessory === "sunglasses" && (
        <g>
          <rect x={62} y={92} width={16} height={12} fill="#000" rx={3} />
          <rect x={92} y={92} width={16} height={12} fill="#000" rx={3} />
          <line x1={78} y1={98} x2={92} y2={98} stroke="#000" strokeWidth={2} />
        </g>
      )}

      {/* Chapeau */}
      {state.hat !== "none" && (
        <g fill={hair}>
          {state.hat === "cap" && <path d="M50,70 C70,55 90,55 110,70 L110,75 L50,75 Z" />}
          {state.hat === "beanie" && <path d="M55,70 L105,70 Q80,45 55,70 Z" />}
          {state.hat === "top" && (
            <g>
              <rect x={68} y={55} width={24} height={20} />
              <rect x={62} y={75} width={36} height={6} />
            </g>
          )}
        </g>
      )}
    </svg>
  );
};

const SectionTiles: React.FC<{
  options: Option[];
  value: string;
  onChange: (id: string) => void;
}> = ({ options, value, onChange }) => (
  <div className="tile-grid">
    {options.map((opt) => (
      <Tile key={opt.id} option={opt} selected={value === opt.id} onSelect={() => onChange(String(opt.id))} />
    ))}
  </div>
);

const AvatarCreator: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const personneIdFromQuery = searchParams.get("personne_id");
  const personneId = personneIdFromQuery || usePersonneId();
  const [state, setState] = useState<AvatarState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [activeKey, setActiveKey] = useState<string>("look");
  const canSave = !!personneId && !loading;
  const [assetsMap, setAssetsMap] = useState<Partial<Record<AvatarCategory, AvatarAsset[]>>>({});
  const [selectedAssets, setSelectedAssets] = useState<Partial<Record<AvatarCategory, string>>>({});

  // Auth guard: besoin d'un uuid valide (URL ou localStorage).
  // Cas admin: si personne_id est fourni en query, on saute la vérif user et on permet l'édition directe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (personneIdFromQuery) {
        // Mode admin direct: autoriser sans validation d'uuid.
        try { localStorage.setItem("personne_id", personneIdFromQuery); } catch {}
        return;
      }
      const uuid = searchParams.get("uuid") || localStorage.getItem("login_uuid");
      if (!uuid) {
        navigate("/login", { replace: true, state: { error: "Vous devez vous connecter pour créer votre avatar." } });
        return;
      }
      const user = await supabaseService.loadUserByLoginToken(uuid);
      if (!user) {
        navigate("/login", { replace: true, state: { error: "Session invalide. Merci de vous reconnecter." } });
        return;
      }
      // Ensure uuid persisted for later navigations
      try { localStorage.setItem("login_uuid", uuid); } catch {}
      // Ensure personne_id present
      try {
        const current = localStorage.getItem("personne_id");
        if (!current) {
          const p = await supabaseService.loadPersonneByUserId(user.id);
          if (p?.id) localStorage.setItem("personne_id", String(p.id));
        }
      } catch {}
      if (!cancelled) {
        // nothing else; existing effect will load avatar when personne_id is available
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams, navigate, personneIdFromQuery]);

  useEffect(() => {
    const load = async () => {
      if (!personneId) return;
      setLoading(true);
      const { data } = await getAvatar(personneId);
      if (data) {
        const incoming = { ...defaultState, ...data } as any;
        // Filtre simple: garder uniquement les clés connues
        const next: AvatarState = {
          skin: incoming.skin,
          hairColor: incoming.hairColor,
          hairStyle: incoming.hairStyle,
          eyeColor: incoming.eyeColor,
          faceShape: incoming.faceShape,
          noseShape: incoming.noseShape,
          mouthShape: incoming.mouthShape,
          facialHair: incoming.facialHair,
          accessory: incoming.accessory,
          hat: incoming.hat,
          top: incoming.top,
          bottom: incoming.bottom,
          assets: incoming.assets || {},
        };
        setState(next);
        if (incoming.assets) setSelectedAssets(incoming.assets as Partial<Record<AvatarCategory, string>>);
        try {
          const avatarRow = await ensureAvatarForPersonne(personneId);
          const choices = await getChoices(avatarRow.id);
          const map: Partial<Record<AvatarCategory, string>> = {};
          for (const c of choices) map[c.category] = c.asset_id;
          if (Object.keys(map).length) setSelectedAssets((prev) => ({ ...prev, ...map }));
        } catch {}
      }
      setLoading(false);
    };
    load();
  }, [personneId]);

  useEffect(() => {
    // Charger tous les assets et grouper par catégorie
    (async () => {
      const all = await listAssets();
      const map: Partial<Record<AvatarCategory, AvatarAsset[]>> = {};
      for (const a of all) {
        if (!map[a.category as AvatarCategory]) map[a.category as AvatarCategory] = [];
        map[a.category as AvatarCategory]!.push(a);
      }
      for (const k of Object.keys(map) as AvatarCategory[]) {
        map[k] = map[k]!.sort((a, b) => a.order_index - b.order_index || (a.label || "").localeCompare(b.label || ""));
      }
      setAssetsMap(map);
      // Pré-sélectionne le premier élément si rien choisi
      setSelectedAssets((prev) => {
        const next = { ...prev };
        for (const c of AvatarCategories.map((x) => x.id)) {
          if (!next[c] && map[c]?.length) next[c] = map[c]![0].id;
        }
        return next;
      });
    })();
  }, []);

  async function handleSave() {
    if (!personneId) return;
    setLoading(true);
    try {
      try {
        await upsertChoicesRPC(personneId, selectedAssets);
      } catch {
        const avatarRow = await ensureAvatarForPersonne(personneId);
        await upsertChoices(avatarRow.id, selectedAssets);
      }
    } finally {
      setLoading(false);
    }
  }

  function set<K extends keyof AvatarState>(key: K, val: AvatarState[K]) {
    setState((s) => ({ ...s, [key]: val }));
  }

  return (
    <div className="container py-3">
      <h2 className="mb-3">Créateur d'avatar</h2>
      {!personneId && (
        <div className="alert alert-warning">Impossible de trouver votre personne_id. La sauvegarde est désactivée.</div>
      )}
      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <div className="p-2 bg-body border rounded text-center sticky-top" style={{ top: 16 }}>
            {/* Aperçu images empilées (si assets) */}
            {Object.keys(selectedAssets).length ? (
              <AssetsLayeredPreview assetsMap={assetsMap} selected={selectedAssets} />
            ) : (
              <AvatarPreview state={state} />
            )}
            <div className="d-flex gap-2 justify-content-center mt-2">
              <Button variant="secondary" disabled={loading} onClick={() => setState(defaultState)}>Réinitialiser</Button>
              <Button variant="primary" disabled={!canSave} onClick={handleSave}>Sauvegarder</Button>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-8">
          <Tabs activeKey={activeKey} onSelect={(k) => k && setActiveKey(k)} id="avatar-tabs" className="mb-3">
            <Tab eventKey="assets" title="Images (beta)">
              {AvatarCategories.map(({ id, label }) => {
                const list = assetsMap[id] || [];
                if (!list.length) return null;
                return (
                  <div className="mb-3" key={id}>
                    <Form.Label>{label}</Form.Label>
                    <div className="tile-grid">
                      {list.map((a) => {
                        const sel = selectedAssets[id] === a.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className={"tile" + (sel ? " selected" : "")}
                            onClick={() => setSelectedAssets((s) => ({ ...s, [id]: a.id }))}
                            title={`${a.label} (z:${a.depth ?? 50})`}
                          >
                            <div className="tile-preview" style={{ background: "#fff" }}>
                              <img src={getPublicUrl(a.storage_path)} alt={a.label} />
                            </div>
                            <div className="tile-label">{a.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </Tab>
            <Tab eventKey="look" title="Visage">
              <div className="mb-3">
                <Form.Label>Couleur de peau</Form.Label>
                <SectionTiles options={skinColors} value={state.skin} onChange={(v) => set("skin", v)} />
              </div>
              <div className="mb-3">
                <Form.Label>Forme du visage</Form.Label>
                <SectionTiles options={faceShapes} value={state.faceShape} onChange={(v) => set("faceShape", v)} />
              </div>
              <div className="mb-3">
                <Form.Label>Forme du nez</Form.Label>
                <SectionTiles options={noseShapes} value={state.noseShape} onChange={(v) => set("noseShape", v)} />
              </div>
              <div className="mb-3">
                <Form.Label>Forme de la bouche</Form.Label>
                <SectionTiles options={mouthShapes} value={state.mouthShape} onChange={(v) => set("mouthShape", v)} />
              </div>
            </Tab>
            <Tab eventKey="hair" title="Cheveux">
              <div className="mb-3">
                <Form.Label>Coupe de cheveux</Form.Label>
                <SectionTiles options={hairStyles} value={state.hairStyle} onChange={(v) => set("hairStyle", v)} />
              </div>
              <div className="mb-3">
                <Form.Label>Couleur des cheveux</Form.Label>
                <SectionTiles options={hairColors} value={state.hairColor} onChange={(v) => set("hairColor", v)} />
              </div>
              <div className="mb-3">
                <Form.Label>Pilosité du visage</Form.Label>
                <SectionTiles options={facialHair} value={state.facialHair} onChange={(v) => set("facialHair", v)} />
              </div>
            </Tab>
            <Tab eventKey="eyes" title="Yeux & Accessoires">
              <div className="mb-3">
                <Form.Label>Couleur des yeux</Form.Label>
                <SectionTiles options={eyeColors} value={state.eyeColor} onChange={(v) => set("eyeColor", v)} />
              </div>
              <div className="mb-3">
                <Form.Label>Accessoires visage</Form.Label>
                <SectionTiles options={accessories} value={state.accessory} onChange={(v) => set("accessory", v)} />
              </div>
              <div className="mb-3">
                <Form.Label>Chapeau</Form.Label>
                <SectionTiles options={hats} value={state.hat} onChange={(v) => set("hat", v)} />
              </div>
            </Tab>
            <Tab eventKey="outfit" title="Tenues">
              <div className="mb-3">
                <Form.Label>Haut</Form.Label>
                <SectionTiles options={tops} value={state.top} onChange={(v) => set("top", v)} />
              </div>
              <div className="mb-3">
                <Form.Label>Bas</Form.Label>
                <SectionTiles options={bottoms} value={state.bottom} onChange={(v) => set("bottom", v)} />
              </div>
            </Tab>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

const AssetsLayeredPreview: React.FC<{
  assetsMap: Partial<Record<AvatarCategory, AvatarAsset[]>>;
  selected: Partial<Record<AvatarCategory, string>>;
}> = ({ assetsMap, selected }) => {
  // Compose la liste d'assets sélectionnés puis trie par profondeur
  const items: AvatarAsset[] = [];
  for (const c of Object.keys(selected) as AvatarCategory[]) {
    const id = selected[c];
    if (!id) continue;
    const found = (assetsMap[c] || []).find((a) => a.id === id);
    if (found) items.push(found);
  }
  items.sort((a, b) => (a.depth ?? 50) - (b.depth ?? 50));

  return (
    <div style={{ width: 240, height: 360, position: "relative", margin: "0 auto", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: 8 }}>
      {items.map((a) => (
        <img
          key={a.id}
          src={getPublicUrl(a.storage_path)}
          alt={a.label}
          style={{ position: "absolute", left: 0, top: 0, width: 240, height: "auto", imageRendering: "pixelated" as any }}
        />
      ))}
    </div>
  );
};

export default AvatarCreator;
