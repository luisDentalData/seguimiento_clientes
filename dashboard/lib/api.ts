
import axios from 'axios';

/**
 * API Client Configuration
 *
 * ⚠️ CLOUD RUN COMPATIBLE: Usa variable de entorno NEXT_PUBLIC_API_URL
 *
 * ¿Por qué NEXT_PUBLIC_API_URL?
 * - En desarrollo local: No está definida → usa 'http://localhost:8001'
 * - En Cloud Run: Debe apuntar a la URL pública del backend
 *   Ejemplo: 'https://dentaldata-backend-xxxxx.run.app'
 *
 * ¿Cómo configurar en Cloud Run?
 * Al hacer deploy del frontend, pasar la variable de entorno:
 *
 *   gcloud run deploy dentaldata-frontend \
 *     --set-env-vars="NEXT_PUBLIC_API_URL=https://dentaldata-backend-xxxxx.run.app"
 *
 * ⚠️ IMPORTANTE: Variables que empiezan con NEXT_PUBLIC_ son accesibles
 * en el código del cliente (browser). Next.js las inyecta durante el build.
 *
 * Variables sin NEXT_PUBLIC_ solo están disponibles en server-side code.
 */

// Obtener la URL del backend desde variable de entorno o fallback a localhost
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

console.log('🔗 API Base URL:', API_BASE_URL);

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    // Timeout de 60 segundos (Cloud Run puede tardar en responder con datos grandes)
    timeout: 60000,
});

// Interceptor para logging (útil para debugging en Cloud Run)
api.interceptors.request.use(
    (config) => {
        // En desarrollo, mostrar requests en consola
        if (process.env.NODE_ENV === 'development') {
            console.log('📤 API Request:', config.method?.toUpperCase(), config.url);
        }
        return config;
    },
    (error) => {
        console.error('❌ API Request Error:', error);
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        // En desarrollo, mostrar responses exitosos
        if (process.env.NODE_ENV === 'development') {
            console.log('📥 API Response:', response.status, response.config.url);
        }
        return response;
    },
    (error) => {
        // Log de errores detallado
        if (error.response) {
            // El servidor respondió con un status fuera del rango 2xx
            console.error('❌ API Error Response:', {
                status: error.response.status,
                data: error.response.data,
                url: error.config?.url,
            });
        } else if (error.request) {
            // La request se hizo pero no hubo respuesta
            console.error('❌ API No Response:', {
                message: 'Backend no responde. ¿Está corriendo?',
                url: error.config?.url,
                baseURL: API_BASE_URL,
            });
        } else {
            // Algo pasó al configurar la request
            console.error('❌ API Request Setup Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default api;
