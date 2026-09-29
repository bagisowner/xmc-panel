import { EngineInstaller } from './EngineInstaller';
import { PaperInstaller } from './PaperInstaller';
import { PurpurInstaller } from './PurpurInstaller';
import { FabricInstaller } from './FabricInstaller';
import { ForgeInstaller } from './ForgeInstaller';
import { VelocityInstaller } from './VelocityInstaller';
import { BungeeCordInstaller } from './BungeeCordInstaller';

export class InstallerRegistry {
  private static instance: InstallerRegistry;
  private installers = new Map<string, EngineInstaller>();

  private constructor() {
    this.register(new PaperInstaller());
    this.register(new PurpurInstaller());
    this.register(new FabricInstaller());
    this.register(new ForgeInstaller());
    this.register(new VelocityInstaller());
    this.register(new BungeeCordInstaller());
  }

  public static getInstance(): InstallerRegistry {
    if (!InstallerRegistry.instance) {
      InstallerRegistry.instance = new InstallerRegistry();
    }
    return InstallerRegistry.instance;
  }

  public register(installer: EngineInstaller): void {
    this.installers.set(installer.engineId.toLowerCase(), installer);
  }

  public getInstaller(engineId: string): EngineInstaller | null {
    if (!engineId) return null;
    const key = engineId.trim().toLowerCase();
    return this.installers.get(key) || null;
  }

  public getAllInstallers(): EngineInstaller[] {
    return Array.from(this.installers.values());
  }
}
