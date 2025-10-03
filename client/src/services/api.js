import axios from 'axios';
import { getAuthToken } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
    baseURL: `${API_BASE_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Axios interceptor: This function runs before every request is sent.
apiClient.interceptors.request.use(
    (config) => {
        const token = getAuthToken(); // Get the token from local storage.
        if (token) {
            // If a token exists, add it to the Authorization header.
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        // Handle any errors during request setup.
        return Promise.reject(error);
    }
);


// ===================================================================
// AUTHENTICATION ENDPOINTS (`/api/v1/auth`)
// ===================================================================

/**
 * Registers a new QuMail user.
 * Corresponds to: POST /api/v1/auth/register
 */
export const registerUser = ({ name, email, password }) => {
    return apiClient.post('/auth/register', { name, email, password });
};

/**
 * Logs in a user with email and password.
 * NOTE: FastAPI's OAuth2PasswordRequestForm requires form data, not JSON.
 * This function handles the special formatting.
 * Corresponds to: POST /api/v1/auth/login
 */
export const loginUser = (email, password) => {
    const formData = new URLSearchParams();
    formData.append('username', email); // FastAPI expects 'username', not 'email'
    formData.append('password', password);
    
    return apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
};


/**
 * Fetches the profile of the currently authenticated user.
 * Corresponds to: GET /api/v1/auth/me
 */
export const getMe = () => {
    return apiClient.get('/auth/me');
};


// ===================================================================
// USER ENDPOINTS (`/api/v1/users`)
// ===================================================================

/**
 * Checks if an email address belongs to a registered QuMail user.
 * Corresponds to: GET /api/v1/users/check
 */
export const checkQuMailUser = (email) => {
    return apiClient.get(`/users/check?email=${encodeURIComponent(email)}`);
};


// ===================================================================
// EMAIL ACTION ENDPOINTS (`/api/v1/emails`)
// ===================================================================

/**
 * Sends a newly composed email.
 * This is the final step after client-side QKD and encryption.
 * Corresponds to: POST /api/v1/emails/send
 */
export const sendFinalEmail = (payload) => {
    // payload: { recipient, subject, body, is_encrypted, protocol }
    return apiClient.post('/emails/send', payload);
};

/**
 * Moves a specific email to the trash on the provider's server.
 * Corresponds to: POST /api/v1/emails/{email_id}/delete
 */
export const deleteEmail = (emailId, folder) => {
    return apiClient.post(`/emails/${emailId}/delete`, { folder });
};
export const archiveEmail = (emailId, folder) => {
    return apiClient.post(`/emails/${emailId}/archive`, { folder });
};
export const markAsRead = (emailId, folder) => {
    return apiClient.post(`/emails/${emailId}/read`, { folder });
};

/**
 * Marks an email as starred on the provider's server.
 * Corresponds to: POST /api/v1/emails/{email_id}/star
 */
export const starEmail = (emailId, folder) => {
    return apiClient.post(`/emails/${emailId}/star`, { folder });
};

/**
 * Removes the star from an email on the provider's server.
 * Corresponds to: POST /api/v1/emails/{email_id}/unstar
 */
export const unstarEmail = (emailId, folder) => {
    return apiClient.post(`/emails/${emailId}/unstar`, { folder });
};