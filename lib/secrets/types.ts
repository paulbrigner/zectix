export type SecretRecord = {
  ref: string;
  value: string;
};

export interface SecretStore {
  getSecret(ref: string): Promise<string | null>;
  setSecret(ref: string | null, value: string): Promise<string>;
  deleteSecret(ref: string): Promise<void>;
}
