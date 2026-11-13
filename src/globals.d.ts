declare const path: { join: (a: string, b: string) => string };
declare namespace NodeJS {
  interface ProcessEnv {
    DB_PATH?: string;
  }
}