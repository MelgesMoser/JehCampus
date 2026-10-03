import { api, connectionState } from "./index.js";
export const auth = {
  isSignedIn: () =>
    connectionState.mode !== "local"
      ? api.authenticated
      : sessionStorage.getItem("jeh-campus:demo-admin") === "yes",
  async signIn(credentials) {
    if (connectionState.mode !== "local") return api.login(credentials);
    sessionStorage.setItem("jeh-campus:demo-admin", "yes");
  },
  async signOut() {
    if (connectionState.mode !== "local") return api.logout();
    sessionStorage.removeItem("jeh-campus:demo-admin");
  },
};
