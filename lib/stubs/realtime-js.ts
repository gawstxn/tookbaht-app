/**
 * Browser stand-in for @supabase/realtime-js (see turbopack.resolveAlias in
 * next.config.ts). Tookbaht never opens a Realtime channel, but supabase-js
 * builds a Realtime client eagerly, which put the whole websocket client in
 * the first-load bundle. Anything that does try to use Realtime fails loudly.
 */
export class RealtimeClient {
  constructor(..._args: unknown[]) {
    void _args;
  }
  channel(): never {
    throw new Error("Supabase Realtime is not bundled in Tookbaht");
  }
  getChannels() {
    return [];
  }
  async removeChannel() {
    return "ok" as const;
  }
  async removeAllChannels() {
    return [];
  }
  async setAuth() {}
}
