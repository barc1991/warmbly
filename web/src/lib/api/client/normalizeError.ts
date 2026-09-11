import axios from "axios";
import { AuthError } from "@/lib/errors/auth";

export interface AppError {
    error: string;
    message: string;
    status?: number;
    redirect?: boolean;
    /** Stable machine-readable code from the API, for branching on a specific
     *  condition rather than matching on human-readable text. */
    code?: string;
    /** Correlation id the API already returns, so a user can quote it and an
     *  operator can find the matching server-side log line. */
    request_id?: string;
}

export function normalizeError(error: unknown): AppError {
    if (error instanceof AuthError) {
        return {
            error: "נדרשת התחברות",
            message: error.message || "יש להתחבר מחדש כדי להמשיך.",
            status: 401,
            redirect: true,
        };
    }

    if (axios.isAxiosError(error)) {
        if (!error.response) {
            // network, CORS, or timeout
            return {
                error: "שגיאת תקשורת",
                message: "אנא בדוק את החיבור לרשת שלך.",
            };
        }

        const status = error.response.status;
        const data = error.response.data;

        if (status === 401) {
            return {
                error: data?.error || "לא מורשה",
                message: data?.message || "פג תוקף ההתחברות שלך או שהיא אינה תקינה.",
                status,
                redirect: true,
                code: data?.code,
                request_id: data?.request_id,
            };
        }

        return {
            error: data?.error || "שגיאה",
            message: data?.message || "אירעה שגיאה בלתי צפויה.",
            status,
            code: data?.code,
            request_id: data?.request_id,
        };
    }

    return {
        error: "שגיאה",
        message: "אירעה שגיאה בלתי צפויה.",
    };
}
