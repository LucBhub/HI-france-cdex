import { type Plant, type Alarm } from "./data";
import { type User } from "@/contexts/auth-context";

export interface ArchitectureImport {
  id: number;
  source: string;
  status: string;
  imported_sites: number;
  notes?: string | null;
  metadata?: Record<string, unknown> | string;
  created_at?: string;
}

export interface ArchitectureSite {
  id: number;
  legacy_plant_id?: number | null;
  site_code: string;
  name: string;
  status?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  address?: string | null;
  ce?: string | null;
  client?: string | null;
  hyperviseur?: boolean | null;
  raw_source?: Record<string, unknown> | string;
  poste_count?: number;
  cellule_count?: number;
  equipement_count?: number;
  onduleur_count?: number;
  has_architecture?: boolean;
}

export interface ArchitecturePoste {
  id: number;
  site_id: number;
  poste_code: string;
  type_poste?: string | null;
  sort_order?: number | null;
  cellules?: ArchitectureCellule[];
  equipements?: ArchitectureEquipement[];
  onduleurs?: ArchitectureOnduleur[];
}

export interface ArchitectureCellule {
  id: number;
  poste_id: number;
  cellule_code: string;
  type_cellule?: string | null;
  ordre_cellule?: number | null;
}

export interface ArchitectureEquipement {
  id: number;
  poste_id: number;
  equipement_code: string;
  type_equipement?: string | null;
}

export interface ArchitectureOnduleur {
  id: number;
  poste_id: number;
  onduleur_code: string;
  type_onduleur?: string | null;
  numero_onduleur?: number | null;
  ip_address?: string | null;
}

export interface ArchitectureTreeSite extends ArchitectureSite {
  postes: ArchitecturePoste[];
}

export interface ArchitectureSummary {
  sites: number;
  sitesWithArchitecture: number;
  sitesWithoutArchitecture: number;
  postes: number;
  cellules: number;
  equipements: number;
  onduleurs: number;
  commands: number;
  imports: ArchitectureImport[];
  sitesByClient: Array<{ client: string; count: number }>;
}

class Fetcher {
  private token: string | null = null;
  private readonly baseUrl: string;
  private onUnauthorized: (() => void) | null = null;

  constructor() {
    const isServer = typeof window === "undefined";

    // Normalize URL function to remove trailing slash and /api suffix if present
    const normalizeUrl = (url: string | undefined) => {
      if (!url) return "";
      let normalized = url;
      if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
      if (normalized.endsWith("/api")) normalized = normalized.slice(0, -4);
      return normalized;
    };

    const serverUrl =
      normalizeUrl(
        process.env.INTERNAL_API_URL ||
          process.env.API_URL ||
          process.env.NEXT_PUBLIC_API_URL,
      ) || "";

    // Default to empty string for client-side to use relative paths (works with Ingress)
    // By forcing empty string, the browser hits the Next.js frontend proxy (/api/...)
    // instead of trying to resolve the actual backend IP, preventing ERR_CONNECTION_REFUSED
    const clientUrl = "";

    this.baseUrl = isServer ? serverUrl : clientUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  setOnUnauthorized(callback: (() => void) | null) {
    this.onUnauthorized = callback;
  }

  private getHeaders(isPublic: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (this.token && !isPublic) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async get<T>(
    endpoint: string,
    options: RequestInit = {},
    isPublic: boolean = false,
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" }, isPublic);
  }

  async post<T>(
    endpoint: string,
    body: any,
    options: RequestInit = {},
    isPublic: boolean = false,
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      { ...options, method: "POST", body: JSON.stringify(body) },
      isPublic,
    );
  }

  async put<T>(
    endpoint: string,
    body: any,
    options: RequestInit = {},
    isPublic: boolean = false,
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      { ...options, method: "PUT", body: JSON.stringify(body) },
      isPublic,
    );
  }

  async delete<T>(
    endpoint: string,
    options: RequestInit = {},
    isPublic: boolean = false,
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      { ...options, method: "DELETE" },
      isPublic,
    );
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit,
    isPublic: boolean,
  ): Promise<T> {
    const headers = new Headers(this.getHeaders(isPublic));
    if (options.headers) {
      const extraHeaders = new Headers(options.headers as HeadersInit);
      extraHeaders.forEach((value, key) => headers.set(key, value));
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      // Handle 401 Unauthorized - JWT expired or invalid
      if (res.status === 401 && this.onUnauthorized) {
        this.onUnauthorized();
      }

      const errorData = await res
        .json()
        .catch(() => ({ message: "An unknown error occurred" }));
      throw new Error(
        errorData.message || `Request failed with status ${res.status}`,
      );
    }

    if (res.status === 204) {
      // Handle No Content response
      return undefined as T;
    }

    return res.json();
  }
}

export const fetcher = new Fetcher();

// Initialize token on client-side load
if (typeof window !== "undefined") {
  const token = localStorage.getItem("authToken");
  fetcher.setToken(token);
}

// Plant API
export async function fetchPlants(): Promise<Plant[]> {
  try {
    return await fetcher.get<Plant[]>("/api/plants", { cache: "no-store" });
  } catch (error) {
    console.error("[API Error] fetchPlants:", error);
    return []; // Return empty array on error to prevent crashes
  }
}

export async function fetchPlantById(id: number): Promise<Plant | undefined> {
  try {
    return await fetcher.get<Plant>(`/api/plants/${id}`, { cache: "no-store" });
  } catch (error) {
    console.error("[API Error] fetchPlantById:", error);
    return undefined;
  }
}

export async function addPlant(
  plantData: any,
): Promise<{ success: boolean; plant?: Plant; message?: string }> {
  try {
    const result = await fetcher.post<{ success: boolean; plant: Plant }>(
      "/api/plants",
      plantData,
    );
    return result;
  } catch (error: any) {
    console.error("[API Error] addPlant:", error);
    return { success: false, message: error.message };
  }
}

export async function updatePlant(
  id: number,
  plantData: any,
): Promise<{ success: boolean; plant?: Plant; message?: string }> {
  try {
    // Remove relays from the root if they are passed separately logic?
    // Based on backend implementation: const { relays, ...plantData } = req.body;
    // So we can pass everything as is.
    const result = await fetcher.put<{ success: boolean; plant: Plant }>(
      `/api/plants/${id}`,
      plantData,
    );
    return result;
  } catch (error: any) {
    console.error("[API Error] updatePlant:", error);
    return { success: false, message: error.message };
  }
}

export async function deletePlant(
  id: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    return await fetcher.delete<{ success: boolean; message?: string }>(
      `/api/plants/${id}`,
    );
  } catch (error: any) {
    console.error("[API Error] deletePlant:", error);
    return { success: false, message: error.message };
  }
}

// Alarm API
export async function fetchAlarms(): Promise<Alarm[]> {
  try {
    return await fetcher.get<Alarm[]>("/api/alarms", { cache: "no-store" });
  } catch (error) {
    console.error("[API Error] fetchAlarms:", error);
    return []; // Always return an array, even on error
  }
}

// User Management API
export async function updateUserRole(
  id: number,
  role: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    await fetcher.put<{ success: boolean }>(`/api/users/${id}/role`, { role });
    return { success: true };
  } catch (error: any) {
    console.error("[API Error] updateUserRole:", error);
    return { success: false, message: error.message };
  }
}

export async function sendUserResetPassword(
  id: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    await fetcher.post<{ success: boolean }>(
      `/api/users/${id}/password-reset`,
      {},
    );
    return { success: true };
  } catch (error: any) {
    console.error("[API Error] sendUserResetPassword:", error);
    return { success: false, message: error.message };
  }
}

export async function fetchUsers(): Promise<User[]> {
  try {
    return await fetcher.get<User[]>("/api/users");
  } catch (error) {
    console.error("[API Error] fetchUsers:", error);
    return [];
  }
}

export async function addUser(
  userData: any,
): Promise<{ success: boolean; user?: User; message?: string }> {
  try {
    const result = await fetcher.post<{ success: boolean; user: User }>(
      "/api/users",
      userData,
    );
    return result;
  } catch (error: any) {
    console.error("[API Error] addUser:", error);
    return { success: false, message: error.message };
  }
}

export async function deleteUser(
  id: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    return await fetcher.delete<{ success: boolean; message?: string }>(
      `/api/users/${id}`,
    );
  } catch (error: any) {
    console.error("[API Error] deleteUser:", error);
    return { success: false, message: error.message };
  }
}

// Auth API
export async function requestPasswordReset(
  email: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await fetcher.post<{ message: string }>(
      "/api/auth/forgot-password",
      { email },
      {},
      true,
    );
    return { success: true, message: result.message };
  } catch (error: any) {
    console.error("[API Error] requestPasswordReset:", error);
    return { success: false, message: error.message };
  }
}

export async function validateResetToken(
  token: string,
): Promise<{ valid: boolean; message?: string }> {
  try {
    await fetcher.get(`/api/auth/reset-password/${token}`, {}, true);
    return { valid: true };
  } catch (error: any) {
    console.error("[API Error] validateResetToken:", error);
    return { valid: false, message: error.message };
  }
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await fetcher.post<{ success: boolean; message: string }>(
      "/api/auth/reset-password",
      { token, password },
      {},
      true,
    );
    return result;
  } catch (error: any) {
    console.error("[API Error] resetPassword:", error);
    return { success: false, message: error.message };
  }
}

// Relay Control API
export async function controlRelay(
  plantId: number,
  relayId: number,
  command: "couple" | "decouple" | "reset",
): Promise<{
  success: boolean;
  message?: string;
  messageKey?: string;
  breakerClosed?: boolean;
}> {
  try {
    return await fetcher.post<{
      success: boolean;
      message: string;
      messageKey?: string;
      breakerClosed: boolean;
    }>(`/api/plants/${plantId}/relays/${relayId}/control`, { command });
  } catch (error: any) {
    console.error("[API Error] controlRelay:", error);
    return { success: false, message: error.message };
  }
}

export async function controlAllRelays(
  plantId: number,
  command: "couple" | "decouple" | "reset",
): Promise<{ success: boolean; message?: string; results?: any[] }> {
  try {
    return await fetcher.post<{
      success: boolean;
      message: string;
      results: any[];
    }>(`/api/plants/${plantId}/relays/control-all`, { command });
  } catch (error: any) {
    console.error("[API Error] controlAllRelays:", error);
    return { success: false, message: error.message };
  }
}

// Device Models API
export async function fetchDeviceModels(): Promise<any[]> {
  try {
    return await fetcher.get<any[]>("/api/device-models");
  } catch (error) {
    console.error("[API Error] fetchDeviceModels:", error);
    return [];
  }
}

export async function createDeviceModel(
  modelData: any,
): Promise<{ success: boolean; message?: string }> {
  try {
    await fetcher.post<{ success: boolean }>("/api/device-models", modelData);
    return { success: true };
  } catch (error: any) {
    console.error("[API Error] createDeviceModel:", error);
    return { success: false, message: error.message };
  }
}

export async function updateDeviceModel(
  id: string,
  modelData: any,
): Promise<{ success: boolean; message?: string }> {
  try {
    await fetcher.put<{ success: boolean }>(
      `/api/device-models/${id}`,
      modelData,
    );
    return { success: true };
  } catch (error: any) {
    console.error("[API Error] updateDeviceModel:", error);
    return { success: false, message: error.message };
  }
}

export async function refreshRelayFaults(
  relayId: number,
): Promise<{ success: boolean; message?: string }> {
  try {
    return await fetcher.post<{ success: boolean; message?: string }>(
      `/api/relays/${relayId}/faults/refresh`,
      {},
    );
  } catch (error: any) {
    console.error("[API Error] refreshRelayFaults:", error);
    return { success: false, message: error.message };
  }
}

// Architecture API
export async function fetchArchitectureSummary(): Promise<ArchitectureSummary | null> {
  try {
    const result = await fetcher.get<{
      success: boolean;
      summary: ArchitectureSummary;
    }>("/api/architecture/summary", { cache: "no-store" });
    return result.summary;
  } catch (error) {
    console.error("[API Error] fetchArchitectureSummary:", error);
    return null;
  }
}

export async function fetchArchitectureSites(): Promise<ArchitectureSite[]> {
  try {
    const result = await fetcher.get<{
      success: boolean;
      sites: ArchitectureSite[];
    }>("/api/architecture/sites", { cache: "no-store" });
    return result.sites || [];
  } catch (error) {
    console.error("[API Error] fetchArchitectureSites:", error);
    return [];
  }
}

export async function fetchArchitectureSiteTree(
  id: number | string,
): Promise<ArchitectureTreeSite | null> {
  try {
    const result = await fetcher.get<{
      success: boolean;
      site: ArchitectureTreeSite;
    }>(`/api/architecture/sites/${id}/tree`, { cache: "no-store" });
    return result.site;
  } catch (error) {
    console.error("[API Error] fetchArchitectureSiteTree:", error);
    return null;
  }
}

export async function fetchArchitectureImports(): Promise<ArchitectureImport[]> {
  try {
    const result = await fetcher.get<{
      success: boolean;
      imports: ArchitectureImport[];
    }>("/api/architecture/imports?limit=10", { cache: "no-store" });
    return result.imports || [];
  } catch (error) {
    console.error("[API Error] fetchArchitectureImports:", error);
    return [];
  }
}
