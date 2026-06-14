'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { X, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

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
  clientId: string | null;   // null => crear; string => editar
  onClose: () => void;
  onSaved: (createdId: string | null) => void;
}

const EMPTY: ClientDetail = {
  name: '', nombre_contacto: '', telefono: '', movil: '',
  provincia: '', nif_cif: '', programa: '', nombres_alternativos: [], emails: [],
};

export default function ClientFormModal({ clientId, onClose, onSaved }: Props) {
  const isEdit = clientId !== null;
  const { data: detail } = useSWR<ClientDetail>(isEdit ? `/clients/${clientId}` : null, fetcher);

  const [form, setForm] = useState<ClientDetail>(EMPTY);
  const [emails, setEmails] = useState<string[]>([]);
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

  const inputClass =
    'w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            {isEdit ? 'Editar cliente' : 'Nuevo cliente'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(85vh-140px)] p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-1">Nombre *</label>
            <input className={inputClass} value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Nombre de la clínica" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Contacto</label>
              <input className={inputClass} value={form.nombre_contacto ?? ''} onChange={e => setField('nombre_contacto', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Programa de gestión</label>
              <input className={inputClass} value={form.programa ?? ''} onChange={e => setField('programa', e.target.value)} placeholder="odontonet, gesden..." />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Provincia</label>
              <input className={inputClass} value={form.provincia ?? ''} onChange={e => setField('provincia', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">NIF / CIF</label>
              <input className={inputClass} value={form.nif_cif ?? ''} onChange={e => setField('nif_cif', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Teléfono</label>
              <input className={inputClass} value={form.telefono ?? ''} onChange={e => setField('telefono', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Móvil</label>
              <input className={inputClass} value={form.movil ?? ''} onChange={e => setField('movil', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Nombres alternativos (separados por coma)</label>
            <input className={inputClass} value={altNames} onChange={e => setAltNames(e.target.value)} placeholder="Razón social, nombre comercial..." />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Emails de matching</label>
            <p className="text-xs text-slate-500 mb-2">Se usan para identificar las reuniones de este cliente en el calendario.</p>
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
                    onClick={() => removeEmail(i)}
                    className="p-2 bg-slate-700 hover:bg-red-500/30 text-slate-300 hover:text-red-300 rounded-lg transition-colors"
                    title="Quitar email"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button onClick={addEmail} className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                <Plus className="w-4 h-4" /> Agregar email
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 px-6 py-4 bg-slate-900/50 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
