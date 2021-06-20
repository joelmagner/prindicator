import * as vscode from "vscode";
import * as Octokit from "@octokit/rest";

const GITHUB_AUTH_PROVIDER_ID = "github";
// https://developer.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/
const SCOPES = ["repo"];

export class Credentials {
  private octokit: Octokit.Octokit | undefined;

  async initialize(context: vscode.ExtensionContext): Promise<void> {
    this.registerListeners(context);
    this.setOctokit();
  }

  private async setOctokit() {
    const session = await vscode.authentication.getSession(
      GITHUB_AUTH_PROVIDER_ID,
      SCOPES,
      { createIfNone: true }
    );

    if (session) {
      this.octokit = new Octokit.Octokit({
        auth: session.accessToken,
      });
      return;
    }

    this.octokit = undefined;
  }

  registerListeners(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.authentication.onDidChangeSessions(async (e) => {
        if (e.provider.id === GITHUB_AUTH_PROVIDER_ID) {
          await this.setOctokit();
        }
      })
    );
  }

  async getOctokit(): Promise<Octokit.Octokit> {
    if (this.octokit) {
      return this.octokit;
    }

    const session = await vscode.authentication.getSession(
      GITHUB_AUTH_PROVIDER_ID,
      SCOPES,
      { createIfNone: true }
    );
    this.octokit = new Octokit.Octokit({
      auth: session.accessToken,
    });

    return this.octokit;
  }
}
