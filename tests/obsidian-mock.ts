export const notices: string[] = [];
export class Notice {
  constructor(text: string) { notices.push(text); }
}
export class Plugin {
  app: any;
  initialData: unknown = null;
  writes: unknown[] = [];
  commands: any[] = [];
  async loadData() { return this.initialData; }
  async saveData(value: unknown) { this.writes.push(value); }
  registerEvent() {}
  registerInterval() {}
  registerDomEvent() {}
  addCommand(command: unknown) { this.commands.push(command); }
}
