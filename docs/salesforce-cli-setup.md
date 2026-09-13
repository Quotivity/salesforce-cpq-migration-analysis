# Setting up the Salesforce CLI

The CPQ Inventory runs as a plugin for the Salesforce CLI, `sf`. This page gets you from nothing to a connected CLI. You need your own Salesforce login with permission to read the CPQ objects (a System Administrator profile is the usual case). No Quotivity account, no connected app, no OAuth grant to us.

## 1. Install Node.js

The CLI is a Node.js program. Install Node.js 22 or newer from [nodejs.org](https://nodejs.org/) (the LTS download), or with your package manager. Check it:

```sh
node --version
```

## 2. Install the Salesforce CLI with npm

```sh
npm install --global @salesforce/cli
sf version
```

`sf version` prints the CLI version. If the command is not found, your npm global bin directory is not on your PATH; `npm prefix -g` shows where it is, and adding its `bin` subfolder to PATH fixes it.

Salesforce also offers installers for Windows and macOS on the [Salesforce CLI setup page](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm). Either route gives you the same `sf` command.

Already have it? Update with:

```sh
sf update
```

## 3. Connect the CLI to your org

This opens a browser window on your Salesforce login page. Sign in as you normally do, including SSO or MFA. The CLI stores the resulting session on your machine only.

```sh
sf org login web --alias my-org
```

For a sandbox:

```sh
sf org login web --alias my-sandbox --instance-url https://test.salesforce.com
```

For a My Domain URL:

```sh
sf org login web --alias my-org --instance-url https://acme.my.salesforce.com
```

Check the connection and the user it is running as:

```sh
sf org display --target-org my-org
```

The alias (`my-org` here) is what you pass to the inventory command. To avoid typing it every time, make it the default:

```sh
sf config set target-org my-org
```

## 4. Install the plugin and run it

```sh
sf plugins install @quotivity/cpq-inventory
sf cpq inventory --target-org my-org
```

The install step asks you to confirm that the plugin is not signed by Salesforce. That is expected; answer yes. Then the command prints which org it connected to, starts a local server on `http://localhost:3579` bound to loopback only, and opens your browser. No query runs until you submit the email gate. Press Enter in the terminal when you are done.

## Troubleshooting

| Symptom | What to do |
|---|---|
| `sf: command not found` after install | Open a new terminal, or add npm's global `bin` folder (`npm prefix -g`) to PATH. |
| Login window never opens | Run the login command with `--no-prompt` removed if present, or copy the URL the CLI prints into a browser yourself. |
| `INVALID_TYPE: sObject type 'SBQQ__…' is not supported` | The org does not have Salesforce CPQ installed, or your user cannot see the CPQ objects. Check the installed packages and your profile. |
| Session expired mid-run | Run `sf org login web --alias my-org` again and restart the command. The CLI refreshes tokens on its own for a normal run. |
| Corporate proxy blocks the install | Set `HTTPS_PROXY` in your shell before the `npm install` and `sf plugins install` steps. The analysis itself makes no outbound requests other than the two HubSpot form posts described in the README. |

## Removing it afterwards

```sh
sf plugins uninstall @quotivity/cpq-inventory
sf org logout --target-org my-org
```

The second command deletes the stored session from your machine.
