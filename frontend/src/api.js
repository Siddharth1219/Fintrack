// =====================================================
// FINTRACK API HELPER
// =====================================================

import { auth } from "./firebase";

const API_BASE_URL = "http://localhost:5000";

// =====================================================
// API REQUEST
// =====================================================

export const apiRequest = async (
    endpoint,
    options = {}
) => {

    try {

        // ---------------------------------------------
        // GET CURRENT FIREBASE USER
        // ---------------------------------------------

        const user = auth.currentUser;

        if (!user) {
            throw new Error(
                "User is not logged in"
            );
        }

        // ---------------------------------------------
        // GET FRESH FIREBASE ID TOKEN
        // ---------------------------------------------

        const token =
            await user.getIdToken();

        // ---------------------------------------------
        // DEFAULT HEADERS
        // ---------------------------------------------
        // ---------------------------------------------

        const headers = {
            "Content-Type": "application/json",

            Authorization:
                `Bearer ${token}`,

            ...(options.headers || {})
        };

        // ---------------------------------------------
        // SEND REQUEST
        // ---------------------------------------------

        const response = await fetch(
            `${API_BASE_URL}${endpoint}`,
            {
                ...options,
                headers
            }
        );

        // ---------------------------------------------
        // READ RESPONSE
        // ---------------------------------------------

        let data;

        try {
            data = await response.json();
        } catch {
            data = {};
        }

        // ---------------------------------------------
        // HANDLE HTTP ERRORS
        // ---------------------------------------------

        if (!response.ok) {

            throw new Error(
                data.message ||
                `Request failed with status ${response.status}`
            );
        }

        // ---------------------------------------------
        // RETURN DATA
        // ---------------------------------------------

        return data;

    } catch (error) {

        console.error(
            "API Request Error:",
            error
        );

        throw error;
    }
};