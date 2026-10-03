import { createRequire } from "node:module";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";

export class DatabaseError extends Error {
  constructor(message = "Não foi possível acessar o Firebase Data Connect.") {
    super(message);
    this.code = "DATA_CONNECT_ERROR";
  }
}

// CLI authentication reuses the existing developer login on this computer.
// Hosted deployments use ADC/workload identity; no credentials reach the browser.
export class DataConnectTransport {
  constructor(config) {
    this.config = config;
    this.service = `projects/${config.firebaseProject}/locations/${config.dataConnectLocation}/services/${config.dataConnectService}`;
  }

  async initialize() {
    if (this.config.dataConnectAuth === "firebase-cli") {
      const require = createRequire(import.meta.url);
      const cliRoot =
        this.config.firebaseCliPath ||
        (process.env.APPDATA &&
          path.join(
            process.env.APPDATA,
            "npm/node_modules/firebase-tools/lib",
          ));
      if (!cliRoot)
        throw new DatabaseError(
          "Configure FIREBASE_CLI_PATH ou utilize DATA_CONNECT_AUTH=adc.",
        );
      try {
        const auth = require(path.join(cliRoot, "auth.js"));
        const { requireAuth } = require(path.join(cliRoot, "requireAuth.js"));
        const account = auth.getGlobalDefaultAccount();
        if (!account) throw new Error("No login");
        await requireAuth({ project: this.config.firebaseProject, ...account });
        this.cli = require(
          path.join(cliRoot, "dataconnect/dataplaneClient.js"),
        );
        this.client = this.cli.dataconnectDataplaneClient();
      } catch {
        throw new DatabaseError(
          "Faça login com firebase login no computador do servidor.",
        );
      }
    } else {
      this.auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
      this.client = await this.auth.getClient();
    }
    return this;
  }

  async execute(query, variables = {}, readOnly = false) {
    let body;
    try {
      if (!this.client) await this.initialize();
      if (this.cli) {
        const method = readOnly
          ? this.cli.executeGraphQLRead
          : this.cli.executeGraphQL;
        const response = await method(this.client, this.service, {
          query,
          variables,
        });
        if (response.status >= 400) throw new DatabaseError();
        body = response.body;
      } else {
        const method = readOnly ? "executeGraphqlRead" : "executeGraphql";
        const response = await this.client.request({
          url: `https://firebasedataconnect.googleapis.com/v1/${this.service}:${method}`,
          method: "POST",
          data: { query, variables },
          timeout: 20000,
        });
        body = response.data;
      }
      if (body.errors?.length || !body.data) throw new DatabaseError();
      return body.data;
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      // Cloud errors can contain query variables and private customer data.
      throw new DatabaseError();
    }
  }
}
