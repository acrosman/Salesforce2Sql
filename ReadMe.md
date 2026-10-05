# Salesforce2Sql

![Lint Status](https://github.com/acrosman/Salesforce2Sql/actions/workflows/lint.yml/badge.svg) ![CodeQL Status](https://github.com/acrosman/Salesforce2Sql/actions/workflows/codeql-analysis.yml/badge.svg) ![Electronegativity Status](https://github.com/acrosman/Salesforce2Sql/actions/workflows/electronegativity.yml/badge.svg) ![Test Status](https://github.com/acrosman/Salesforce2Sql/actions/workflows/tests.yml/badge.svg)

This is a tool to generate a SQL schema to match a Salesforce Org Schema.

![Main Interface](documentation/InterfaceScreenshots/MainScreen.png?raw=true)

Salesforce2Sql will connect to a Salesforce org, allow you to select a collection of objects, and have the schema for those objects replicated to a local database. This can be very useful when working on data migration and archiving projects.

_No data is replicated just the schema._

If you are looking for help migrating data between Salesforce Orgs you may want check out the [Salesforce Open Source Commons Data Generation Toolkit Project](https://github.com/SFDO-Community-Sprints/DataGenerationToolkit).

## Getting Started

Read the full [Getting Started guide](documentation/GettingStarted.md).

_There is also a [getting started guide](https://spinningcode.org/2022/05/getting-started-with-salesforce2sql/) on SpinningCode.org with a bit more commentary._

You can either download the [latest release](https://github.com/acrosman/Salesforce2Sql/releases/latest) for your operating system or run from code.

To make this tool useful you will also need a Salesforce org you want to mirror, and a MySQL, Mariadb, or Postgres database you can create tables in.

### Running From Code

To run the project from code you will need a working copy of [NodeJS](https://nodejs.org) 22 or later.

1. Clone this repo (or create your own fork) to your local machine.
1. Run: `npm install` from the project root directory, and wait for all the packages to load (this takes a few minutes).
1. Run: `npm start`

When running from code you can also provide OAuth credentials through environment variables exported in your shell. If they are set, they take precedence over the values saved in Preferences:

```sh
export SALESFORCE_CLIENT_ID=your_consumer_key
export SALESFORCE_CLIENT_SECRET=your_consumer_secret
npm start
```

## Connecting to Salesforce

Salesforce2Sql connects to Salesforce with OAuth. Sign-in happens in your default web browser, so it supports single sign-on (SSO) and multi-factor authentication. To use OAuth you create an External Client App in your org once, then enter its credentials in Salesforce2Sql.

### Set Up an External Client App in Salesforce

1. In Salesforce, go to **Setup → App Manager** (use Quick Find if needed).
2. Click **New External Client App**.
3. Enter a **Name**, accept or edit the generated **API Name**, and enter a **Contact Email**.
4. Under API check the box to **Enable OAuth**.
5. Set the **Callback URL** to `http://localhost:3835/callback`. If you change the callback port in Salesforce2Sql Preferences, use that port here instead.
6. Add these **OAuth Scopes**:
   - **Manage user data via APIs (api)**
   - **Access the identity URL service (id, profile, email, address, phone)**
   - **Perform requests at any time (refresh_token, offline_access)**
7. Click Create, and then view the app's details.
8. Open the settings tab, expand OAuth settings, and click the Consumer Key and Secret button.
9. Save the **Consumer Key** and **Consumer Secret** from the OAuth settings to Salesforce2Sql settings (or a temporary location).

For full details see the Salesforce Help article [Create an External Client App](https://help.salesforce.com/s/articleView?id=xcloud.create_a_local_external_client_app.htm&type=5).

### Configure Salesforce2Sql

1. Open the Preferences window.
2. Scroll to **Salesforce OAuth Settings**.
3. Paste in the **Consumer Key** as the **OAuth Client ID**, and the **Consumer Secret** as the **OAuth Client Secret**.
4. Optionally change the **OAuth Callback Port** (default `3835`). It must match the port in the External Client App's Callback URL.
5. Save your changes.
6. Delete any other local copy of the OAuth keys.

Saved credentials aren't shown again in Preferences. To keep them, leave the fields blank; to replace them, enter new values; to delete them, check **Remove saved OAuth credentials** and save. Your operating system may ask for permission to access the stored credentials the first time you connect.

The client ID and secret are stored encrypted. If your system doesn't support encrypted storage, they are kept only for the current session and must be re-entered after a restart.

### Log In

1. Click **Create New Connection**. Salesforce2Sql won't attempt an OAuth login until the client ID and secret are saved in Preferences.
2. Leave **OAuth2** selected.
3. Set the **Login URL**: Use your org's [My Domain](https://help.salesforce.com/s/articleView?id=xcloud.domain_name_overview.htm&type=5) URL, for example `https://yourcompany.my.salesforce.com` or `https://yourcompany--sandboxname.sandbox.my.salesforce.com`.
   `https://login.salesforce.com` and `https://test.salesforce.com` can't be used with OAuth and External Client Apps, so always use your My Domain URL. My Domain login also supports single sign-on (SSO).
4. Click **Connect**, then sign in and approve access in the browser window that opens.
5. When the browser shows "Authentication successful", close the tab and return to Salesforce2Sql.

If you don't finish signing in within five minutes, the attempt times out and you can try again.

While connected, the **Create New Connection** button is hidden. Click **Logout** to disconnect and connect to a different org.

### Username/Password (deprecated)

<!-- DEPRECATED(password-login): remove this section when #290 is done. -->

Logging in with a username, password, and security token is still available by choosing **Username/Password (deprecated)** in the login window. This option can use `https://login.salesforce.com` or `https://test.salesforce.com`. **This option is deprecated and will be removed in a future version** (see [#290](https://github.com/acrosman/Salesforce2Sql/issues/290)). Please switch to OAuth.

## Databases

Currently Salesforce2Sql supports MySQL, MariaDB, and Postgres. Other databases supported by [KNEX.JS](https://knexjs.org/) can be added upon request.

## Disclaimer

This project has no direct association with Salesforce except the use of the APIs provided under the terms of use of their services.

## Getting Involved

If you would like to contribute to this project please feel invited to do so. Feel free to review open [issues](issues) and read the [contributing guide](contributing.md).
