'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { Modal, Button, Alert } from '@/dd/components';

const fetcher = (url: string) => api.get(url).then(res => res.data);

interface ClientDetail {
  name: string;
  nombre_contacto?: string | null;
  telefono?: string | null;
  movil?: string | null;
  provincia?: string | null;
  nif_cif?: string | null;
  programa?: string | null;
  nombres_alternativos?: string[];
  emails?: string[];
}

interface Props {
  clientId: string | null;
  onClose: () => void;
  onSaved: (createdId: string | null) => void;
}

const EMPTY: ClientDetail = {
  name: '', nombre_contacto: '', telefono: '', movil: '',
  provincia: '', nif_cif: '', programa: '', nombres_alternativos: [], emails: [],
};

const inputClass =
  'w-full px-3 py-2 bg-canvas border border-fg-subtle text-fg text-sm rounded-sm placeholder-fg-subtle focus:outline-none focus:border-ink transition-colors duration-base';

export default function ClientFormModal({ clientId, onClose, onSaved }: Props) {
  const isEdit = clientId !== null;
  const { data: detail } = useSWR<ClientDetail>(isEdit ? `/clients/${clientId}` : null, fetcher);

  const [form, setForm] = useState<ClientDetail>(EMPTY);
  const [emails, setEmails] = useState<string[]>(['']);
  const [altNames, setAltNames] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (detail) {
      setForm(detail);
      setEmails(detail.emails && detail.emails.length > 0 ? detail.emails : ['']);
      setAltNames((detail.nombres_alternativos ?? []).join(', '));
    } else if (!isEdit) {
      setForm(EMPTY);
      setEmails(['']);
      setAltNames('');
    }
  }, [detail, isEdit]);

  const setField = (field: keyof ClientDetail, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const updateEmail = (i: number, value: string) =>
    setEmails(prev => prev.map((e, idx) => (idx === i ? value : e)));
  const addEmail = () => setEmails(prev => [...prev, '']);
  const removeEmail = (i: number) => setEmails(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    const payload = {
      name: form.name.trim(),
      nombre_contacto: form.nombre_contacto || null,
      telefono: form.telefono || null,
      movil: form.movil || null,
      provincia: form.provincia || null,
      nif_cif: form.nif_cif || null,
      programa: form.programa || null,
      nombres_alternativos: altNames.split(',').map(s => s.trim()).filter(Boolean),
      emails: emails.map(e => e.trim()).filter(Boolean),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/clients/${clientId}`, payload);
        onSaved(null);
      } else {
        const res = await api.post('/clients', payload);
        onSaved(res.data?.id ?? null);
      }
      onClose();
    } catch (err: unknown) {
      const detailMsg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detailMsg || 'No se pudo guardar el cliente. Reintentá.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={clientId !== undefined}
      onClose={onClose}
      title={isEdit ? 'Editar cliente' : 'Nuevo cliente'}
      className="max-w-2xl"
    >
      <div className="overflow-y-auto max-h-[60vh] space-y-4 pr-1">
        {error && <Alert variant="error">{error}</Alert>}

        <div>
          <label className="block text-xs text-fg-muted mb-1">Nombre *</label>
          <input className={inputClass} value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Nombre de la clínica" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-fg-muted mb-1">Contacto</label>
            <input className={inputClass} value={form.nombre_contacto ?? ''} onChange={e => setField('nombre_contacto', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">Programa de gestión</label>
            <input className={inputClass} value={form.programa ?? ''} onChange={e => setField('programa', e.target.value)} placeholder="odontonet, gesden..." />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">Provincia</label>
            <input className={inputClass} value={form.provincia ?? ''} onChange={e => setField('provincia', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">NIF / CIF</label>
            <input className={inputClass} value={form.nif_cif ?? ''} onChange={e => setField('nif_cif', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">Teléfono</label>
            <input className={inputClass} value={form.telefono ?? ''} onChange={e => setField('telefono', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">Móvil</label>
            <input className={inputClass} value={form.movil ?? ''} onChange={e => setField('movil', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-xs text-fg-muted mb-1">Nombres alternativos (separados por coma)</label>
          <input className={inputClass} value={altNames} onChange={e => setAltNames(e.target.value)} placeholder="Razón social, nombre comercial..." />
        </div>

        <div>
          <label className="block text-xs text-fg-muted mb-1">Emails de matching</label>
          <p className="text-xs text-fg-subtle mb-2">Se usan para identificar las reuniones de este cliente en el calendario.</p>
          <div className="space-y-2">
            {emails.map((email, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputClass}
                  value={email}
                  onChange={e => updateEmail(i, e.target.value)}
                  placeholder="email@cliente.com"
                />
                <button
                  type="button"
                  onClick={() => removeEmail(i)}
                  title="Quitar email"
                  className="px-2 text-fg-muted hover:text-danger-fg transition-colors duration-base"
                >
                  <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">delete</span>
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addEmail}
              className="flex items-center gap-1.5 text-xs text-boss-primary hover:text-boss-primary-2 transition-colors duration-base"
            >
              <span className="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">add</span>
              Agregar email
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-line">
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={saving} disabled={saving} onClick={handleSubmit}>
          {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
      </div>
    </Modal>
  );
}
