import type { DateLibrary } from "./formats.js";

export interface LibraryInfo {
  name: DateLibrary;
  version: string | null;
  format: string | null;
  supported: boolean;
  value: string | null;
  error?: string;
}

export interface LibraryBridgeRequest {
  type: "adp:library";
  token: string;
  year: number;
  month: number;
  day: number;
  mode: "set" | "inspect";
}

export interface LibraryBridgeResponse {
  ok: boolean;
  info: LibraryInfo;
}

export interface FormatRecord {
  pattern: string;
  learnedAt: number;
}

export interface ExtensionConfig {
  earliestYear: number;
  futureYears: number;
}

export interface GetConfigRequest {
  type: "adp:get-config";
}

export interface GetConfigResponse {
  config: ExtensionConfig;
}

export interface GetFormatRequest {
  type: "adp:get-format";
  origin: string;
  fieldKey: string;
}

export interface GetFormatResponse {
  format: string | null;
}

export interface SetFormatRequest {
  type: "adp:set-format";
  origin: string;
  fieldKey: string;
  pattern: string;
}

export interface SetFormatResponse {
  ok: boolean;
}

export type BackgroundRequest =
  LibraryBridgeRequest | GetConfigRequest | GetFormatRequest | SetFormatRequest;

export const DEFAULT_CONFIG: ExtensionConfig = {
  earliestYear: 1900,
  futureYears: 30,
};
