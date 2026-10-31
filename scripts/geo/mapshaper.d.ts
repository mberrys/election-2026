declare module "mapshaper" {
  /** Run a mapshaper command string against files on disk. */
  export function runCommands(commands: string): Promise<void>;
  /** Run commands against in-memory inputs; resolves with output files keyed by name. */
  export function applyCommands(
    commands: string,
    inputs?: Record<string, string | Buffer | object>,
  ): Promise<Record<string, string | Buffer>>;
  export function enableLogging(): void;
}
