
export interface Client {
    id: string;
    name: string;
    nombre_normalizado?: string;
    nombres_alternativos?: string[];
    nombre_contacto?: string;
    telefono?: string;
    movil?: string;
    direccion?: string;
    poblacion?: string;
    provincia?: string;
    nif_cif?: string;
    programa?: string;
    fuentes?: string[];
    status: string;
    created_at?: string;
    updated_at?: string;
}

export interface Appointment {
    id: string;
    analyst_email: string;
    summary: string;
    description?: string;
    start_time: string;
    end_time: string;
    attendees: string[];

    is_client_meeting: boolean;
    match_status: 'CONFIRMED' | 'PROBABLE' | 'NO_MATCH' | 'INTERNAL';
    match_confidence: number;
    match_reason?: string;
    matched_client_id?: string;
    matched_client?: Client;
}

export interface SummaryStats {
    total_clients: number;
    clients_with_meetings: number;
    clients_without_meetings: number;
    status_distribution: Array<{ status: string; count: number }>;
    analyst_stats: Array<{
        analyst: string;
        total_appointments: number;
        confirmed_meetings: number;
    }>;
}

export interface ClientWithMeetings {
    id: string;
    name: string;
    nombre_contacto?: string;
    telefono?: string;
    movil?: string;
    programa?: string;
    provincia?: string;
    meeting_count: number;
}

export interface ClientWithoutMeetings {
    id: string;
    name: string;
    nombre_contacto?: string;
    telefono?: string;
    movil?: string;
    programa?: string;
    provincia?: string;
}

// Respuesta de GET /clients/portfolio — estado calculado en el BACKEND.
export type ClientStatus = 'OK' | 'ATTENTION' | 'CRITICAL';

// Respuesta de GET /stats/categories — carga de reuniones por categoría.
export interface CategoryStats {
    total: { category: string; count: number }[];
    by_analyst: { analyst: string; categories: Record<string, number> }[];
    by_month: { month: string; categories: Record<string, number> }[];
}

export interface PortfolioClient {
    id: string;
    name: string;
    nombre_contacto?: string | null;
    programa?: string | null;
    provincia?: string | null;
    last_session: string | null;   // ISO date o null
    days_since: number | null;     // null si nunca tuvo sesión válida
    valid_sessions: number;
    last_analyst: string | null;
    status: ClientStatus;
}
