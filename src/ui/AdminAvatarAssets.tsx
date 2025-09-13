import React, { useEffect, useMemo, useState } from "react";
import { Button, Col, Form, InputGroup, Row, Table } from "react-bootstrap";
import {
  AvatarAsset,
  AvatarCategories,
  AvatarCategory,
  createAsset,
  deleteAsset,
  getPublicUrl,
  listAssets,
  replaceAssetFile,
  updateAsset,
  moveAssetToCategory,
} from "../services/AvatarAssetsService";

function CategorySelect({ value, onChange }: { value: AvatarCategory; onChange: (v: AvatarCategory) => void }) {
  return (
    <Form.Select value={value} onChange={(e) => onChange(e.target.value as AvatarCategory)}>
      {AvatarCategories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </Form.Select>
  );
}

export default function AdminAvatarAssets() {
  const [category, setCategory] = useState<AvatarCategory>("skin");
  const [assets, setAssets] = useState<AvatarAsset[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [orderIndex, setOrderIndex] = useState<number>(0);
  const [depth, setDepth] = useState<number>(50);
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => {
    const map: Record<string, AvatarAsset[]> = {};
    for (const a of assets) {
      const key = a.category;
      map[key] = map[key] || [];
      map[key].push(a);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.order_index - b.order_index || a.label.localeCompare(b.label));
    }
    return map;
  }, [assets]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function refresh() {
    setBusy(true);
    try {
      setAssets(await listAssets(category));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !label) return;
    setBusy(true);
    try {
      await createAsset({ file, label, category, order_index: orderIndex, depth });
      setFile(null);
      setLabel("");
      setOrderIndex(0);
      setDepth(50);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(a: AvatarAsset, patch: Partial<AvatarAsset>) {
    setBusy(true);
    try {
      await updateAsset(a.id, {
        label: patch.label ?? a.label,
        order_index: patch.order_index ?? a.order_index,
        depth: patch.depth ?? a.depth,
        category: (patch.category as AvatarCategory) ?? a.category,
        enabled: patch.enabled ?? a.enabled,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleReplace(a: AvatarAsset, f: File | null) {
    if (!f) return;
    setBusy(true);
    try {
      await replaceAssetFile(a.id, a.storage_path, f);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(a: AvatarAsset) {
    if (!confirm(`Supprimer ${a.label} ?`)) return;
    setBusy(true);
    try {
      await deleteAsset(a.id, a.storage_path);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-3">
      <h2>Assets Avatar</h2>

      <Row className="g-2 align-items-end mb-3">
        <Col sm={12} md={3}>
          <Form.Label>Catégorie</Form.Label>
          <CategorySelect value={category} onChange={setCategory} />
        </Col>
        <Col sm={12} md={9}>
          <Form onSubmit={handleCreate} className="d-flex gap-2 align-items-end flex-wrap">
            <div>
              <Form.Label>Image</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.currentTarget.files?.[0] || null)}
              />
            </div>
            <div>
              <Form.Label>Label</Form.Label>
              <Form.Control value={label} disabled={busy} onChange={(e) => setLabel(e.target.value)} placeholder="Nom" />
            </div>
            <div>
              <Form.Label>Ordre</Form.Label>
              <Form.Control
                type="number"
                value={orderIndex}
                disabled={busy}
                onChange={(e) => setOrderIndex(parseInt(e.target.value || "0", 10))}
                style={{ width: 100 }}
              />
            </div>
            <div>
              <Form.Label>Profondeur (0-99)</Form.Label>
              <Form.Control
                type="number"
                min={0}
                max={99}
                value={depth}
                disabled={busy}
                onChange={(e) => setDepth(Math.max(0, Math.min(99, parseInt(e.target.value || "50", 10))))}
                style={{ width: 120 }}
              />
            </div>
            <div>
              <Button type="submit" disabled={busy || !file || !label}>
                Ajouter
              </Button>
            </div>
          </Form>
        </Col>
      </Row>

      <Table striped bordered hover size="sm" responsive>
        <thead>
          <tr>
            <th>Prévisu</th>
            <th>Label</th>
            <th>Catégorie</th>
            <th>Ordre</th>
            <th>Profondeur</th>
            <th>Chemin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id}>
              <td>
                <img src={getPublicUrl(a.storage_path)} alt={a.label} style={{ height: 48, imageRendering: "pixelated" }} />
              </td>
              <td>
                <InputGroup size="sm">
                  <Form.Control defaultValue={a.label} onBlur={(e) => e.target.value !== a.label && handleUpdate(a, { label: e.target.value })} />
                </InputGroup>
              </td>
              <td>
                <CategorySelect
                  value={a.category as AvatarCategory}
                  onChange={async (v) => {
                    if (v === a.category) return;
                    setBusy(true);
                    try {
                      await moveAssetToCategory(a.id, a.storage_path, v);
                      await refresh();
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </td>
              <td style={{ width: 110 }}>
                <Form.Control
                  size="sm"
                  type="number"
                  defaultValue={a.order_index}
                  onBlur={(e) => {
                    const v = parseInt(e.target.value || "0", 10);
                    if (v !== a.order_index) handleUpdate(a, { order_index: v });
                  }}
                />
              </td>
              <td style={{ width: 130 }}>
                <Form.Control
                  size="sm"
                  type="number"
                  min={0}
                  max={99}
                  defaultValue={a.depth ?? 50}
                  onBlur={(e) => {
                    const v = Math.max(0, Math.min(99, parseInt(e.target.value || "50", 10)));
                    if (v !== a.depth) handleUpdate(a, { depth: v });
                  }}
                />
              </td>
              <td>
                <code>{a.storage_path}</code>
              </td>
              <td>
                <div className="d-flex gap-2 align-items-center flex-wrap">
                  <Form.Label className="mb-0">Remplacer</Form.Label>
                  <Form.Control
                    size="sm"
                    type="file"
                    accept="image/*"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleReplace(a, e.currentTarget.files?.[0] || null)}
                    style={{ width: 220 }}
                  />
                  <Button variant="danger" size="sm" onClick={() => handleDelete(a)}>
                    Supprimer
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {busy && <div>Chargement…</div>}
    </div>
  );
}
