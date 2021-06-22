import * as vscode from "vscode";
import { Credentials } from "./GitHubOAuth";
import { Octokit } from "@octokit/rest";

export class PullRequests {
  private _octokit!: Octokit;
  private _credentials: Credentials;
  private _userInfo?: any;

  INITIAL_MESSAGE = true;
  META_DATA = { prs: 0, completed: 0, isOwn: 0 };
  public USER_SETTINGS: { updateTimer: number; displaySummary: boolean };

  constructor(private readonly _context: vscode.ExtensionContext) {
    this._credentials = new Credentials();
    this.USER_SETTINGS = {
      displaySummary: this.getDisplaySummary(),
      updateTimer: this.getUpdateTimer(),
    };
  }

  public async setDisplaySummary(value: boolean): Promise<void> {
    await this._context.globalState.update("displaySummary", value);
    this.USER_SETTINGS.displaySummary = value;
  }

  public getDisplaySummary(): boolean {
    const state = this._context.globalState.get(
      "displaySummary",
      false
    ) as boolean;
    console.log("DISPLAY SUMMARY", state);
    return state;
  }

  public async setUpdateTimer(value: number): Promise<void> {
    await this._context.globalState.update("updateTimer", value);
  }

  public getUpdateTimer(): number {
    const timer = parseInt(this._context.globalState.get("updateTimer", "15"));
    console.log("TIMER", timer);
    if (timer && timer >= 5) return timer;

    return 15; // 15 min default.
  }

  public async authenticateGithub() {
    await this._credentials.initialize(this._context);

    this._octokit = await this._credentials.getOctokit();
    const octokit = this._octokit;

    const userInfo = await this._octokit.users.getAuthenticated();
    this._userInfo = userInfo;
    return { userInfo, octokit };
  }

  public wasRecentPullRequest = (
    prCreatedDate: string,
    withinMinutes: number
  ) => {
    const now = new Date(new Date().toISOString()).getTime();
    const createdAt = new Date(prCreatedDate).getTime();
    return Math.abs(now - createdAt) / 60000 < withinMinutes;
  };

  public getAllPrs = async (owner: string, repo: string) => {
    return await this._octokit.pulls
      .list({
        owner,
        repo,
      })
      .then((x) => x?.data);
  };

  public getPrComments = async (
    owner: string,
    repo: string,
    pull_number: number
  ) => {
    return await this._octokit.pulls
      .listReviews({ owner, repo, pull_number })
      .then((x) => x.data)
      .catch((x) => console.log("Fetching Comments", x));
  };

  public checkForNewPRs = async (owner: string, repo: string) => {
    // reset global count
    this.META_DATA.completed = 0;
    this.META_DATA.isOwn = 0;
    this.META_DATA.prs = 0;

    const prs = await this.getAllPrs(owner, repo);

    if (!prs) return;

    this.META_DATA.prs = prs.length;

    for (let pr in prs) {
      const isOwnPr = prs[pr].user?.login === this._userInfo.data.login;
      const comments: any = await this.getPrComments(
        owner,
        repo,
        prs[pr].number
      );
      const youHaveApprovedPr = comments.some((x: any) => {
        return x.state === "APPROVED" &&
          x.user?.login === this._userInfo.data.login
          ? true
          : false;
      });

      if (youHaveApprovedPr) this.META_DATA.completed++;

      if (isOwnPr) this.META_DATA.isOwn++;

      if (
        !isOwnPr &&
        this.wasRecentPullRequest(
          prs[pr].created_at,
          this.USER_SETTINGS.updateTimer
        )
      ) {
        vscode.window
          .showInformationMessage(
            `🚀 Pull Request #${prs[pr].number} from '${prs[pr].user?.login}' just arrived!`,
            "Review it!"
          )
          .then((selection) => {
            if (selection === "Review it!") {
              vscode.env.openExternal(vscode.Uri.parse(`${prs[pr].html_url}`));
            }
          });
      }
    }

    if (this.INITIAL_MESSAGE && this.USER_SETTINGS.displaySummary) {
      this.INITIAL_MESSAGE = false;

      vscode.window.showInformationMessage(
        `There are ${
          this.META_DATA.prs - this.META_DATA.isOwn
        } open pull requests in this repository! (${
          this.META_DATA.completed > 0
            ? (
                (this.META_DATA.completed /
                  (this.META_DATA.prs - this.META_DATA.isOwn)) *
                100
              ).toFixed(0)
            : 0
        }% done)`
      );
    }
  };
}
