import * as vscode from "vscode";
import { GitExtension } from "../git";
import { Credentials } from "./GitHubOAuth";
import { PullRequests } from "./PullRequests";
export async function activate(context: vscode.ExtensionContext) {
  let credentials: Credentials;
  let gitExtension: GitExtension | undefined;
  console.log('"VS Code  PullRequest indicator" is now active!');
  // https://github.com/eamodio/vscode-gitlens/blob/e556d3302d6b72982721d73d07105aeeea0b8a74/src/git/models/repository.ts#L151

  const pullRequests = new PullRequests(context);
  let { userInfo, octokit } = await pullRequests.authenticateGithub();

  const retrieveGitInformation = async () => {
    gitExtension =
      vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;
    const git = gitExtension?.getAPI(1);
    const gitUri = git?.repositories?.[0]?.rootUri;
    if (!gitUri) return;
    const repo = await git?.openRepository?.(gitUri);
    const remoteOriginUrl = (await repo?.getConfigs?.())?.find(
      (k) => k?.key === "remote.origin.url"
    )?.value;

    const isSSH = (str?: string) => str?.includes("git@github.com:");

    const stringMatchUrl = remoteOriginUrl?.match(
      /([a-zA-Z0-9!@#\$%\^\&*\)\(+=._-]+)/g
    );

    if (isSSH(remoteOriginUrl)) {
      return {
        owner: stringMatchUrl?.[1] ?? "",
        repo: stringMatchUrl?.[2]?.split(".git")[0] ?? "",
      };
    } else {
      return {
        owner: stringMatchUrl?.[2] ?? "",
        repo: stringMatchUrl?.[3]?.split(".git")[0] ?? "",
      };
    }
  };

  const git = await retrieveGitInformation();
  if (!git) return; //TODO: display a message maybe?

  setInterval(async () => {
    if (!userInfo?.data?.login) {
      vscode.window
        .showInformationMessage(`Login to github!`, "Sign in")
        .then((selection) => {
          if (selection === "Sign in") {
            vscode.commands.executeCommand("prindicator.authenticateGithub");
          }
        });
    } else {
      await pullRequests.checkForNewPRs(git.owner, git.repo);
    }
  }, pullRequests.getUpdateTimer()); //TODO: ändra till 5min eller ngt.

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "prindicator.authenticateGithub",
      async () => {
        if (!credentials) {
          credentials = new Credentials();
        }
        await credentials.initialize(context);
        octokit = await credentials.getOctokit();
        userInfo = await octokit.users.getAuthenticated();
        vscode.window.showInformationMessage(
          `Logged into GitHub as ${userInfo.data.login}`
        );
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("prindicator.displaySummary", async () => {
      vscode.window
        .showQuickPick(["Yes", "No"], {
          placeHolder: `Set wheather to display a summary message or not. Currently: ${pullRequests.getDisplaySummary()}`,
          canPickMany: false,
        })
        .then(async (selection) => {
          if (!selection) return;
          await pullRequests.setDisplaySummary(selection === "Yes");
        });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("prindicator.setUpdateTimer", async () => {
      vscode.window
        .showQuickPick(["5", "10", "15", "20", "25", "30", "50", "60"], {
          placeHolder: `Set the update interval to GitHub. Current Value: ${pullRequests.getUpdateTimer()} minutes`,
          canPickMany: false,
        })
        .then(async (selection) => {
          if (!selection) return;
          const duration = parseInt(selection);
          await pullRequests.setUpdateTimer(duration);
        });
    })
  );

  // context.subscriptions.push(
  //   vscode.commands.registerCommand(
  //     "prindicator.resetWorkspace",
  //     async () => {
  //       context.globalState.update("PR", []);
  //     }
  //   )
  // );

  // context.subscriptions.push(
  //   vscode.commands.registerCommand(
  //     "prindicator.displayNotification",
  //     async () => {
  //       /**
  //        * Octokit (https://github.com/octokit/rest.js#readme) is a library for making REST API
  //        * calls to GitHub. It provides convenient typings that can be helpful for using the API.
  //        *
  //        * Documentation on GitHub's REST API can be found here: https://docs.github.com/en/rest
  //        */
  //       const octokit = await credentials.getOctokit();
  //       const userInfo = await octokit.users.getAuthenticated();

  //       // setInterval(() => {
  //       //   const prs = sidebarProvider.checkForNewPRs();
  //       //   sidebarProvider.savePRsToLocalStorage([321, 321, 321]);
  //       // }, 5000);

  //       vscode.window.showInformationMessage(
  //         `Logged 222 into GitHub as ${userInfo.data.login}`
  //       );
  //     }
  //   )
  // );

  // context.subscriptions.push(
  //   vscode.commands.registerCommand("prindicator.displayNotification", () => {
  //     // HelloWorldPanel.createOrShow(context.extensionUri);
  //   })
  // );

  // context.subscriptions.push(
  //   vscode.window.registerWebviewViewProvider(
  //     "pr-indicator-sidebar",
  //     sidebarProvider
  //   )
  // );
}

// this method is called when your extension is deactivated
export function deactivate() {}
